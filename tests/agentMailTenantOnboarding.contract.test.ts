import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Fleetmail AgentMail tenant onboarding',()=>{
 const signup=readFileSync('src/components/auth/SignUpPage.tsx','utf8');
 const gate=readFileSync('src/components/onboarding/AgentMailOnboardingGate.tsx','utf8');
 const provisioning=readFileSync('src/server/services/agentMailTenantProvisioning.ts','utf8');
 const route=readFileSync('src/server/routes/agentMailOnboarding.ts','utf8');
 const app=readFileSync('src/server/app.ts','utf8');
 const root=readFileSync('src/App.tsx','utf8');

 it('collects business and inbox identity for new owners but not invited members',()=>{
  expect(signup).toContain('Business name');
  expect(signup).toContain('Fleet inbox name');
  expect(signup).toContain('!invited');
  expect(signup).toContain('PENDING_AGENTMAIL_ONBOARDING_KEY');
  expect(signup).not.toContain('AGENTMAIL_API_KEY');
 });

 it('forces first-owner onboarding before the workspace opens',()=>{
  expect(root).toContain('<AgentMailOnboardingGate>');
  expect(gate).toContain('/api/agentmail/onboarding/status');
  expect(gate).toContain('/api/agentmail/onboarding/provision');
  expect(gate).toContain('Create your dedicated AgentMail workspace');
 });

 it('provisions one pod, inbox, scoped key and pod-filtered webhook idempotently',()=>{
  expect(provisioning).toContain('mail.pods.list({clientId:organizationId})');
  expect(provisioning).toContain('mail.pods.create({clientId:organizationId})');
  expect(provisioning).toContain('mail.pods.inboxes.list(pod.externalPodId)');
  expect(provisioning).toContain('mail.pods.inboxes.create(pod.externalPodId');
  expect(provisioning).toContain('mail.pods.apiKeys.create(pod.externalPodId');
  expect(provisioning).toContain("eventTypes:['message.received','message.sent']");
  expect(provisioning).toContain('podIds:[pod.externalPodId]');
  expect(provisioning).toContain('agentmailPods');
  expect(provisioning).toContain('agentmailWebhooks');
 });

 it('encrypts the tenant scoped key and never exposes it to the client',()=>{
  expect(provisioning).toContain("createCipheriv('aes-256-gcm'");
  expect(provisioning).toContain('TENANT_SECRET_KEK_REF');
  expect(provisioning).toContain('podKeySecretRef:sealed');
  expect(route).not.toContain('apiKey');
 });

 it('mounts onboarding before inbox scoping so an empty organization can provision',()=>{
  expect(app.indexOf("app.use('/api/agentmail/onboarding',agentMailOnboardingRouter)")).toBeGreaterThan(-1);
  expect(app.indexOf("app.use('/api/agentmail/onboarding',agentMailOnboardingRouter)")).toBeLessThan(app.indexOf("app.use('/api/agentmail',enforceAgentMailInboxScope)"));
 });

 it('does not leak the MOMS inbox into tenant defaults',()=>{
  expect(root).toContain("useState<string>('')");
  expect(root).not.toContain("useState<string>('moms@agentmail.to')");
  expect(root).toContain("fleetFetch('/api/status')");
  expect(root).toContain('if (!activeInbox) return');
 });

 it('keeps legacy owner inboxes active without forcing pod migration',()=>{
  expect(provisioning).toContain("mode:'legacy'");
  expect(provisioning).toContain('if(!pod&&activeInboxes.length)');
 });

 it('never calls AgentMail agent sign-up during tenant onboarding',()=>{
  expect(provisioning).not.toContain('agent/sign-up');
  expect(route).not.toContain('agent/sign-up');
 });
});
