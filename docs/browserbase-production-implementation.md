# FleetMail Browserbase Production Implementation Contract

## Purpose

FleetMail must expose a small, reliable set of user-facing web capabilities while keeping Browserbase implementation details out of the language model. The runtime—not the model—owns provider selection, browser lifecycle, validation, caching, and confirmation boundaries.

This document is the implementation contract and release gate for Browserbase in FleetMail.

## Source implementation patterns

This contract is derived from the Browserbase templates and current Browserbase/Stagehand documentation supplied for this build:

- Extend + Browserbase: browser navigation -> observed download controls -> Browserbase Downloads -> document extraction.
- Browserbase + Reducto: browser navigation -> PDF download -> Browserbase Downloads -> structured document extraction.
- Proxies Weather: Browserbase session configured with Browserbase geolocation proxies -> Stagehand structured extraction.
- Basic Caching: repeated Stagehand operations must produce a Browserbase cache hit when the page and instruction are unchanged.
- Council Events: dynamic pages should be normalized into structured records rather than returned as raw page dumps.
- Company Value Proposition Generator: company pages should be extracted into typed, structured company data for enrichment and outreach.
- Form Filling: Stagehand observe -> semantic field mapping -> act/fill -> stop before submission unless the user explicitly confirms.
- Gift Finder: browser extraction should return structured candidates that can be ranked by the Fleet agent instead of exposing DOM/browser internals.

Current Stagehand v4 requirements used here:

- Node.js 22.18+.
- `@browserbasehq/stagehand` + `zod`.
- `browserbase.launch({ apiKey })` for Browserbase cloud sessions.
- `Stagehand.create({ browser })`.
- `stagehand.observe`, `stagehand.act`, and `stagehand.extract` for semantic browser automation.
- Browserbase Model Gateway is used automatically when no separate model is configured.
- Browserbase-managed proxies use `proxies: [{ type: "browserbase", geolocation: { city, state, country } }]`.
- Repeated Stagehand operations use Browserbase server-side caching.

## User-facing capability contract

The Fleet agent may request only these web capabilities:

1. `research`
   - Search the open web for companies, people, fleet prospects, locations, vendor information, services, or current public facts.
   - Search does not require the user to provide a URL.
   - Preferred path: Browserbase Search API; Firecrawl may be used as a compatibility fallback when configured.

2. `extract`
   - Open a public company or information page and return structured data.
   - Uses a Browserbase session + Stagehand typed extraction for dynamic pages.

3. `browse`
   - Open and inspect a dynamic page in a real Browserbase browser session.
   - Read-only unless a separate confirmed action authorizes a mutation.

4. `form`
   - Observe fields, map supplied values semantically, and fill them.
   - Submission is never implicit. `submit` requires an explicit confirmed executor.

5. `document`
   - Open/download a PDF or other web-hosted document through a Browserbase session and return it for FleetMail document parsing.
   - Download/session metadata must be recorded when available.

6. `geo`
   - Run extraction/browsing through a Browserbase geolocation proxy when location-specific rendering matters.
   - Default US prospecting geography may be derived from explicit user location/ZIP input, not guessed silently.

Internal FleetOS facts continue to come from Neon/domain services. Browserbase must never become the source of truth for fleet accounts, vehicles, work orders, schedules, invoices, payments, inspections, or tenant authorization.

## Runtime architecture

`FleetAgentRuntime -> deterministic capability router -> BrowserbaseCapabilityService -> normalized result -> LLM response`

The model never receives Browserbase credentials and never constructs Browserbase API calls.

Every web execution result must contain:

- `capability`
- `provider`
- `status`
- `sourceUrls`
- `data/content`
- `sessionId` when a cloud browser session was created
- `cacheStatus` when available
- `error` when failed/blocked
- `durationMs`

The model may claim success only when runtime status is `success`.

## Security and confirmation boundaries

- Validate all target URLs before navigation.
- Reject private/local/link-local targets and unsafe schemes.
- Never expose Browserbase API keys, session credentials, provider payloads, DOM selectors, or raw tool syntax in visible chat output.
- Browser reads/extraction may execute automatically.
- Form preparation and field filling may execute automatically only when the user explicitly asks for it.
- Form submission, checkout, sending, deleting, approving, purchasing, scheduling, or any other consequential external mutation requires explicit confirmation.
- Browser sessions must close in `finally` blocks.
- Never silently convert an internal Fleet query into an open-web query.

## Routing rules

Examples that MUST resolve to open-web research:

- "Find a new company in 19002 for prospecting."
- "Find HVAC companies near Ambler."
- "Search the web for fleet prospects in 19002."
- "Research Hertler HVAC."

Examples that MUST resolve to internal Fleet reads first:

- "Who is Zachary?"
- "Which vehicles are overdue?"
- "What does ABC Fleet owe us?"
- "Show Unit 230's work orders."

Examples that MUST resolve to Browserbase browser execution:

- "Open this website and inspect the contact form: https://..."
- "Fill out this vendor registration form: https://..."
- "Download this PDF: https://..."

## Output sanitation contract

The following must never reach the user-visible response in any case:

- `<function_calls>` / `</function_calls>`
- `<function_call>` / `</function_call>`
- `<tool_call>` / `</tool_call>`
- `<dots_function_call>` / `</dots_function_call>`
- `<invoke ...>` / `</invoke>`
- serialized provider JSON payloads or XML-like invocation blocks

Hidden FleetMail review blocks for email/action proposals remain parsed by the server and removed before display.

## White-box tests

The implementation is not complete until all of these pass:

1. Configuration
   - Browserbase key detected in production.
   - Stagehand dependency installed.
   - Node runtime satisfies Stagehand requirements.

2. Search
   - A no-URL prospecting query such as `find a company in 19002 for prospecting` routes to web research and produces external results when Browserbase is configured.

3. Structured company extraction
   - A company website is opened in Browserbase and extracted into a typed company research object.

4. Browser navigation
   - An explicit `open/visit/browse` URL request creates a Browserbase session and returns readable page context.

5. Form preparation
   - Stagehand observes available fields and returns semantic field mappings.
   - The runtime does not submit without confirmation.

6. Documents
   - A direct PDF/document request routes to document capability rather than ordinary research.

7. Geolocation
   - A Browserbase session can be created with an explicit city/state/country proxy configuration.

8. Caching
   - Repeating the same Stagehand observation/extraction reports a Browserbase cache hit when supported.

9. Fleet isolation
   - An ordinary Fleet account/vehicle/work-order query does not create an external browser session.

10. Output safety
    - All known function/tool markup variants are stripped before the response reaches the UI.

11. Failure truthfulness
    - A failed Browserbase operation returns `failed`/`blocked` and the LLM is not allowed to claim the task succeeded.

## Release gate

Do not merge this implementation until:

- TypeScript passes.
- Unit/contract tests pass.
- Vercel preview reaches READY.
- Browserbase live smoke test proves at minimum: search, session navigation, typed extraction, and form observe/preparation.
- No raw tool-call markup appears in returned chat text.

The implementation document and the code must remain aligned. Any future Browserbase behavior change requires updating this contract and its contract tests in the same PR.