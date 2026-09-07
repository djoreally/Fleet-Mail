import { Router, type Request } from "express";
import type { AgentMailTenantOnboardingService } from "./onboardingService.js";
import type { WebhookSignatureVerifier } from "./ports.js";
import type { AgentMailWebhookEnvelope } from "./types.js";
import type { AgentMailTenantWebhookRouter } from "./webhookRouter.js";

export type AuthenticatedTenantRequest = Request & {
  auth?: { tenantId: string; canManageIntegrations: boolean };
  rawBody?: Buffer;
};

export function createAgentMailTenantRouter(deps: {
  onboarding: AgentMailTenantOnboardingService;
  webhooks: AgentMailTenantWebhookRouter;
  signatures: WebhookSignatureVerifier;
}): Router {
  const router = Router();

  router.post("/tenants/:tenantId/agentmail/provision", async (req: AuthenticatedTenantRequest, res) => {
    if (!req.auth?.canManageIntegrations || req.auth.tenantId !== req.params.tenantId) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    try {
      const state = await deps.onboarding.provision({
        tenantId: req.params.tenantId,
        inboxUsername: String(req.body?.inboxUsername ?? "fleet"),
        displayName: String(req.body?.displayName ?? "Fleet Operations"),
      });
      // Deliberately return metadata only. Secret references also stay server-side.
      res.status(200).json({ status: state.status, inboxAddress: state.inboxAddress });
    } catch {
      res.status(503).json({ error: "agentmail_provisioning_incomplete" });
    }
  });

  router.post("/webhooks/agentmail", async (req: AuthenticatedTenantRequest, res) => {
    const rawBody = req.rawBody;
    if (!rawBody || !(await deps.signatures.verify(rawBody, req.headers))) {
      res.status(401).json({ error: "invalid_signature" });
      return;
    }
    const event = normalizeWebhook(req.body);
    await deps.webhooks.route(event);
    res.status(202).json({ accepted: true });
  });

  return router;
}

function normalizeWebhook(body: Record<string, unknown>): AgentMailWebhookEnvelope {
  return {
    eventType: String(body.event_type ?? body.type ?? "unknown"),
    eventId: typeof body.event_id === "string" ? body.event_id : undefined,
    podId: typeof body.pod_id === "string" ? body.pod_id : undefined,
    inboxId: typeof body.inbox_id === "string" ? body.inbox_id : undefined,
    payload: body,
  };
}
