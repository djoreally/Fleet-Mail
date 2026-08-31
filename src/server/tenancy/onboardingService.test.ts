import { describe, expect, it } from "vitest";
import { AgentMailTenantOnboardingService } from "./onboardingService.js";
import type { AgentMailTenantGateway, EncryptedSecretStore, TenantStateStore } from "./ports.js";
import type { AgentMailTenantState, EncryptedSecretRef } from "./types.js";

const tenantId = "0f7691c6-45db-4f60-81df-20db48c8d916";

describe("AgentMail tenant onboarding", () => {
it("provisions one pod and resumes idempotently", async () => {
  const records = new Map<string, AgentMailTenantState>();
  const counts = { pod: 0, inbox: 0, key: 0, webhook: 0 };
  const stateStore: TenantStateStore = {
    get: async (id) => records.get(id) ?? null,
    save: async (state) => void records.set(state.tenantId, state),
    findByPodId: async () => null,
    findByInboxId: async () => null,
  };
  const gateway: AgentMailTenantGateway = {
    ensurePod: async (clientId) => ({ podId: `pod-${clientId}-${++counts.pod}` }),
    ensureInbox: async () => ({ inboxId: `inbox-${++counts.inbox}`, address: "fleet@agentmail.to" }),
    createPodScopedKey: async () => ({ apiKey: `secret-${++counts.key}` }),
    ensureWebhook: async () => ({ webhookId: `webhook-${++counts.webhook}` }),
  };
  const storedPlaintexts: string[] = [];
  const secrets: EncryptedSecretStore = {
    put: async (_name, value) => {
      storedPlaintexts.push(value);
      return "vault://tenant-key" as EncryptedSecretRef;
    },
    delete: async () => undefined,
  };
  const service = new AgentMailTenantOnboardingService(stateStore, gateway, secrets, {
    publicBaseUrl: "https://fleet.example/",
  });

  const first = await service.provision({ tenantId, inboxUsername: "fleet", displayName: "Fleet" });
  const second = await service.provision({ tenantId, inboxUsername: "fleet", displayName: "Fleet" });

  expect(first.status).toBe("active");
  expect(second).toEqual(first);
  expect(counts).toEqual({ pod: 1, inbox: 1, key: 1, webhook: 1 });
  expect(storedPlaintexts).toEqual(["secret-1"]);
  expect(JSON.stringify(first)).not.toContain("secret-1");
});
});
