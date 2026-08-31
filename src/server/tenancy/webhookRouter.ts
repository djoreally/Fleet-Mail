import type { TenantStateStore, TenantWebhookHandler } from "./ports.js";
import type { AgentMailWebhookEnvelope } from "./types.js";

export class AgentMailTenantWebhookRouter {
  constructor(
    private readonly states: TenantStateStore,
    private readonly handler: TenantWebhookHandler,
  ) {}

  async route(event: AgentMailWebhookEnvelope): Promise<void> {
    const byPod = event.podId ? await this.states.findByPodId(event.podId) : null;
    const byInbox = event.inboxId ? await this.states.findByInboxId(event.inboxId) : null;
    if (byPod && byInbox && byPod.tenantId !== byInbox.tenantId) {
      throw new Error("AgentMail webhook pod/inbox tenant mismatch");
    }
    const tenant = byPod ?? byInbox;
    if (!tenant || tenant.status !== "active") {
      throw new UnknownAgentMailTenantError(event.podId, event.inboxId);
    }
    await this.handler.handle({ tenantId: tenant.tenantId, event });
  }
}

export class UnknownAgentMailTenantError extends Error {
  constructor(podId?: string, inboxId?: string) {
    super(`No active tenant mapping for pod=${podId ?? "none"}, inbox=${inboxId ?? "none"}`);
  }
}
