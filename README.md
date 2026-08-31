# Fleet OS

Fleet OS is a multitenant fleet operations command center built around the lifecycle:

`request → schedule → dispatch → inspection → authorization → service → invoice`

Its Fleet Inbox uses AgentMail and AI assistance to turn fleet communication into operational work while the application keeps vehicles, maintenance, customers, parts, documents, and financial records organization-scoped.

## Requirements

- Node.js 22
- npm 10+
- PostgreSQL 17 or a compatible Neon PostgreSQL database

Install exactly the locked dependency tree:

```bash
npm ci
```

Copy `.env.example` to `.env` for local development. Never commit `.env` files or put server credentials in variables beginning with `VITE_`; Vite exposes those variables to browsers.

## Environment contract

Server-only secrets:

- `DATABASE_URL` (preferred) or `NEON_DATABASE_URL`: PostgreSQL connection used by migrations and server persistence.
- `AGENTMAIL_API_KEY`: verified Fleet OS AgentMail organization key.
- `AGENTMAIL_WEBHOOK_SECRET`: verifies raw AgentMail webhook payloads.
- `ATLASCLOUD_API_KEY`: primary AI provider credential.
- `TENANT_SECRET_KEK_REF`: secret-manager/KMS reference used for tenant-scoped AgentMail keys.

Runtime configuration:

- `APP_PUBLIC_URL`: public HTTPS origin used for webhook registration.
- `DEFAULT_INBOX`: development fallback inbox only; production tenant routing must derive the inbox from the authenticated organization.
- `VITE_NEON_AUTH_URL`: browser-safe Neon Auth endpoint.
- `VITE_NEON_DATA_API_URL`: browser-safe Data API endpoint. It is not a credential and must still be protected by authentication and RLS.

For the one-time AgentMail control-plane setup and per-tenant pod lifecycle, see [docs/agentmail-multi-tenancy.md](docs/agentmail-multi-tenancy.md).

## Development

```bash
npm run dev
```

## Quality gates

Run the same aggregate gate used before release:

```bash
npm run check
```

Individual gates:

```bash
npm run typecheck
npm run test
npm run db:validate
npm run build
```

`db:validate` verifies the fleet schema contract, including required tenant ownership on core tables. GitHub Actions additionally starts disposable PostgreSQL 17 and runs `npm run db:smoke`. That command creates the Drizzle schema and applies the checked-in forward RLS migration without using staging or production data.

To run the migration smoke test locally, point only at a disposable database:

```bash
DATABASE_URL=postgresql://fleet_os:fleet_os_test@localhost:5432/fleet_os_test npm run db:smoke
```

Do not run migrations against staging or production from an unreviewed branch. The release sequence is schema validation, disposable migration, tests, typecheck, build, preview verification, then an explicitly approved production migration.
