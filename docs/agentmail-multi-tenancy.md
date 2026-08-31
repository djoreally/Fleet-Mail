# AgentMail multi-tenancy

Fleet OS uses one verified AgentMail organization as its control plane and one AgentMail Pod per Fleet OS organization. The pod `clientId` is the internal organization UUID. Each pod receives its own inbox, pod-scoped key, and pod-filtered webhook.

## One-time control-plane bootstrap

Create and verify the Fleet OS AgentMail organization outside the web application. Never expose the AgentMail `agent/sign-up` endpoint as a Fleet OS route and never call it during tenant onboarding: repeating sign-up for the same human email rotates the organization key.

```bash
agentmail agent sign-up --human-email OWNER_EMAIL --username fleet-os
```

Complete the emailed OTP verification, then store the returned organization key directly in the deployment secret manager. The application must only receive its secret reference/injected value at runtime.

## Required server environment

- `AGENTMAIL_API_KEY`: Fleet OS organization-level key; server runtime only.
- `AGENTMAIL_WEBHOOK_SECRET`: signature-verification secret; server runtime only.
- `APP_PUBLIC_URL`: HTTPS origin used to register `/api/webhooks/agentmail`.
- `TENANT_SECRET_KEK_REF`: reference to the KMS/secret-manager key that encrypts tenant scoped keys.

No AgentMail credential may use a `VITE_` prefix or be serialized in an API response. Tenant records store only an opaque `scopedKeyRef` returned by `EncryptedSecretStore`.

## Onboarding lifecycle

`pending -> pod_ready -> inbox_ready -> credentials_ready -> webhook_ready -> active`

Every transition is checkpointed. Retrying resumes from the last completed step. The persistence adapter must serialize onboarding calls for an organization (transaction/advisory lock) and enforce unique constraints on tenant ID, pod ID, and inbox ID. The AgentMail gateway resolves pod by `clientId` and inbox by username before creating resources.

Webhook requests must be signature-verified against their raw body. Routing resolves `pod_id` and/or `inbox_id` to one active internal organization and rejects missing or conflicting mappings.
