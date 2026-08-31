import type { AgentMailTenantGateway } from "../tenancy/ports.js";

/** Minimal structural SDK contract keeps this adapter mockable in unit tests. */
export interface AgentMailSdk {
  pods: {
    list(input?: { clientId?: string }): Promise<{ pods?: Array<{ podId: string; clientId?: string }> }>;
    create(input: { clientId: string }): Promise<{ podId: string }>;
    inboxes: {
      list(podId: string): Promise<{ inboxes?: Array<{ inboxId: string; username?: string; address?: string }> }>;
      create(podId: string, input: { username: string; displayName: string }): Promise<{ inboxId: string; address?: string }>;
    };
    apiKeys: {
      create(podId: string, input: { name: string }): Promise<{ apiKey: string }>;
    };
  };
  webhooks: {
    list(): Promise<{ webhooks?: Array<{ webhookId: string; url?: string; podIds?: string[] }> }>;
    create(input: { url: string; eventTypes: string[]; podIds: string[] }): Promise<{ webhookId: string }>;
  };
}

export class AgentMailSdkGateway implements AgentMailTenantGateway {
  constructor(private readonly client: AgentMailSdk) {}

  async ensurePod(clientId: string): Promise<{ podId: string }> {
    const result = await this.client.pods.list({ clientId });
    const existing = result.pods?.find((pod) => pod.clientId === clientId);
    return existing ?? this.client.pods.create({ clientId });
  }

  async ensureInbox(podId: string, input: { username: string; displayName: string }) {
    const result = await this.client.pods.inboxes.list(podId);
    const existing = result.inboxes?.find((inbox) => inbox.username === input.username);
    return existing ?? this.client.pods.inboxes.create(podId, input);
  }

  createPodScopedKey(podId: string, name: string) {
    return this.client.pods.apiKeys.create(podId, { name });
  }

  async ensureWebhook(input: { url: string; eventTypes: string[]; podIds: string[] }) {
    const result = await this.client.webhooks.list();
    const existing = result.webhooks?.find(
      (webhook) => webhook.url === input.url && input.podIds.every((id) => webhook.podIds?.includes(id)),
    );
    return existing ?? this.client.webhooks.create(input);
  }
}
