import type {
  AgentMailTenantState,
  EncryptedSecretRef,
  TenantId,
  TenantWebhookContext,
} from "./types.js";

export interface TenantStateStore {
  get(tenantId: TenantId): Promise<AgentMailTenantState | null>;
  save(state: AgentMailTenantState): Promise<void>;
  findByPodId(podId: string): Promise<AgentMailTenantState | null>;
  findByInboxId(inboxId: string): Promise<AgentMailTenantState | null>;
}

export interface EncryptedSecretStore {
  /** Encrypts at rest and returns an opaque reference. Implementations must never log value. */
  put(name: string, value: string): Promise<EncryptedSecretRef>;
  delete(ref: EncryptedSecretRef): Promise<void>;
}

export interface AgentMailTenantGateway {
  /** Resolves an existing pod by clientId before creating one. */
  ensurePod(clientId: TenantId): Promise<{ podId: string }>;
  /** Resolves an existing inbox in the pod by username before creating one. */
  ensureInbox(
    podId: string,
    input: { username: string; displayName: string },
  ): Promise<{ inboxId: string; address?: string }>;
  createPodScopedKey(podId: string, name: string): Promise<{ apiKey: string }>;
  ensureWebhook(input: {
    url: string;
    eventTypes: string[];
    podIds: string[];
  }): Promise<{ webhookId: string }>;
}

export interface TenantWebhookHandler {
  handle(context: TenantWebhookContext): Promise<void>;
}

export interface WebhookSignatureVerifier {
  verify(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): Promise<boolean>;
}
