import type { AgentMailTenantGateway, EncryptedSecretStore, TenantStateStore } from "./ports.js";
import type { AgentMailTenantState, TenantProvisioningRequest } from "./types.js";

export interface TenantOnboardingOptions {
  publicBaseUrl: string;
  eventTypes?: string[];
  now?: () => Date;
}

export class AgentMailTenantOnboardingService {
  constructor(
    private readonly states: TenantStateStore,
    private readonly agentMail: AgentMailTenantGateway,
    private readonly secrets: EncryptedSecretStore,
    private readonly options: TenantOnboardingOptions,
  ) {}

  /** Resumes safely from the last persisted checkpoint. Concurrent calls must be serialized by the store. */
  async provision(request: TenantProvisioningRequest): Promise<AgentMailTenantState> {
    this.assertRequest(request);
    let state = (await this.states.get(request.tenantId)) ?? this.initialState(request.tenantId);
    if (state.status === "active") return state;

    try {
      if (!state.podId) {
        const pod = await this.agentMail.ensurePod(request.tenantId);
        state = await this.checkpoint(state, { podId: pod.podId, status: "pod_ready" });
      }

      if (!state.inboxId) {
        const inbox = await this.agentMail.ensureInbox(state.podId, {
          username: request.inboxUsername,
          displayName: request.displayName,
        });
        state = await this.checkpoint(state, {
          inboxId: inbox.inboxId,
          inboxAddress: inbox.address,
          status: "inbox_ready",
        });
      }

      if (!state.scopedKeyRef) {
        const credential = await this.agentMail.createPodScopedKey(
          state.podId,
          `fleet-os-${request.tenantId}`,
        );
        // The plaintext exists only for this server-side call and is never persisted in tenant state.
        const secretRef = await this.secrets.put(
          `agentmail/tenants/${request.tenantId}/pod-key`,
          credential.apiKey,
        );
        state = await this.checkpoint(state, {
          scopedKeyRef: secretRef,
          status: "credentials_ready",
        });
      }

      if (!state.webhookId) {
        const webhook = await this.agentMail.ensureWebhook({
          url: `${this.options.publicBaseUrl.replace(/\/$/, "")}/api/webhooks/agentmail`,
          eventTypes: this.options.eventTypes ?? ["message.received", "message.sent"],
          podIds: [state.podId],
        });
        state = await this.checkpoint(state, {
          webhookId: webhook.webhookId,
          status: "webhook_ready",
        });
      }

      return this.checkpoint(state, { status: "active", lastError: undefined });
    } catch (error) {
      const failed = await this.checkpoint(state, {
        status: "failed",
        lastError: error instanceof Error ? error.message : "Tenant provisioning failed",
      });
      throw new TenantProvisioningError(failed, error);
    }
  }

  private async checkpoint(
    current: AgentMailTenantState,
    patch: Partial<AgentMailTenantState>,
  ): Promise<AgentMailTenantState> {
    const next = { ...current, ...patch, updatedAt: this.now() };
    await this.states.save(next);
    return next;
  }

  private initialState(tenantId: string): AgentMailTenantState {
    return { tenantId, status: "pending", updatedAt: this.now() };
  }

  private now(): string {
    return (this.options.now?.() ?? new Date()).toISOString();
  }

  private assertRequest(request: TenantProvisioningRequest): void {
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(request.tenantId)) {
      throw new Error("tenantId must be an internal organization UUID");
    }
    if (!/^[a-z0-9][a-z0-9._-]{1,62}$/i.test(request.inboxUsername)) {
      throw new Error("inboxUsername is invalid");
    }
  }
}

export class TenantProvisioningError extends Error {
  constructor(public readonly state: AgentMailTenantState, cause: unknown) {
    super("AgentMail tenant provisioning did not complete", { cause });
  }
}
