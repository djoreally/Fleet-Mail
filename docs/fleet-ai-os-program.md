# Fleet AI OS implementation program

Goal: evolve Fleet-Mail from a communication-first application into an AI-native fleet operating system while preserving AgentMail as the communication layer, Firecrawl as primary web research, and Browserbase as confirmation-gated browser execution.

## Canonical operating chain

Fleet Account -> Contacts -> Locations -> Vehicles -> Maintenance Programs -> Work Orders -> Appointments -> Dispatch -> Inspection -> Authorization -> Service Lines / Parts / Fluids -> Invoice -> Payment -> Vehicle History

## Delivery sequence

1. Canonical Fleet Account domain and account detail experience.
2. Vehicle operational profile and maintenance history.
3. Work Order lifecycle and status contract.
4. Inspection and authorization workflow.
5. Service lines, parts, fluids, and inventory consumption.
6. Invoice/payment handoff and account balances.
7. Scheduling, dispatch, check-in, completion, and technician workflow.
8. Fleet-agent tools over the canonical domain objects.
9. Inbox-to-operation automation: email -> account/vehicle recognition -> proposed work order/schedule/reply.
10. Firecrawl research tools and Browserbase explicit browser-action workflows with confirmation before consequential actions.
11. Proactive intelligence: PM due, unanswered requests, open recommendations, unpaid invoices, missing PO, capacity risk, and sales opportunities.

## Engineering rule

No mock-only feature releases. Each slice ships schema/domain contract, backend persistence/API, connected frontend, tests, preview verification, and production merge together.

## Data ownership

Fleet-Mail remains on its existing Neon Postgres + Drizzle architecture. ServiceWriter Fleet OS is a reference model only; its Supabase database is not a dependency of Fleet-Mail.
