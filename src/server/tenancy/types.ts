export type TenantId = string;

export type AgentMailTenantStatus =
  | "pending"
  | "pod_ready"
  | "inbox_ready"
  | "credentials_ready"
  | "webhook_ready"
  | "active"
  | "failed";

/** A pointer to encrypted server-side storage. It is never an AgentMail key. */
export type EncryptedSecretRef = string & { readonly __encryptedSecretRef: true };

export interface AgentMailTenantState {
  tenantId: TenantId;
  status: AgentMailTenantStatus;
  podId?: string;
  inboxId?: string;
  inboxAddress?: string;
  scopedKeyRef?: EncryptedSecretRef;
  webhookId?: string;
  lastError?: string;
  updatedAt: string;
}

export interface TenantProvisioningRequest {
  tenantId: TenantId;
  inboxUsername: string;
  displayName: string;
}

export interface AgentMailWebhookEnvelope {
  eventType: string;
  podId?: string;
  inboxId?: string;
  eventId?: string;
  payload: unknown;
}

export interface TenantWebhookContext {
  tenantId: TenantId;
  event: AgentMailWebhookEnvelope;
}
