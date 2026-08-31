import { describe, expect, it, vi } from "vitest";
import type { AgentMailTenantState } from "./types.js";
import { AgentMailTenantWebhookRouter } from "./webhookRouter.js";

const state = (tenantId: string): AgentMailTenantState => ({
  tenantId,
  status: "active",
  podId: `pod-${tenantId}`,
  inboxId: `inbox-${tenantId}`,
  updatedAt: new Date(0).toISOString(),
});

describe("AgentMail tenant webhook routing", () => {
it("rejects a webhook whose pod and inbox resolve to different tenants", async () => {
  const podTenant = state("a");
  const inboxTenant = state("b");
  const router = new AgentMailTenantWebhookRouter(
    {
      get: async () => null,
      save: async () => undefined,
      findByPodId: async () => podTenant,
      findByInboxId: async () => inboxTenant,
    },
    { handle: vi.fn(async () => undefined) },
  );

  await expect(router.route({ eventType: "message.received", podId: "pod-a", inboxId: "inbox-b", payload: {} }))
    .rejects.toThrow(/tenant mismatch/);
});
});
