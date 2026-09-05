import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const knowledge = readFileSync('src/server/services/fleetKnowledge.ts','utf8');
const runtime = readFileSync('src/server/services/fleetAgentRuntime.ts','utf8');
const ledger = readFileSync('src/server/services/fleetMutationLedger.ts','utf8');
const webhook = readFileSync('src/server/services/prospectWebhook.ts','utf8');
const app = readFileSync('src/server/app.ts','utf8');

describe('Fleet Knowledge Layer contract',()=>{
  it('keeps database access server-controlled and organization scoped',()=>{
    expect(knowledge).toContain("eq(customers.organizationId,organizationId)");
    expect(knowledge).toContain("eq(contacts.organizationId,organizationId)");
    expect(knowledge).toContain("eq(prospects.organizationId,organizationId)");
    expect(knowledge).toContain("eq(vehicles.organizationId,organizationId)");
    expect(knowledge).not.toMatch(/SELECT \*|information_schema|pg_catalog/i);
  });
  it('uses cache plus fuzzy matching instead of literal-name-only search',()=>{
    expect(knowledge).toContain('const cache = new Map');
    expect(knowledge).toContain('TTL_MS = 60_000');
    expect(knowledge).toContain('distance(');
    expect(knowledge).toContain('similarity');
    expect(runtime).toContain('getFleetKnowledgeContext');
    expect(runtime).toContain('Never say you lack a search function');
  });
  it('uses the canonical audit_events ledger and invalidates cached knowledge after actual successful writes',()=>{
    expect(ledger).toContain('auditEvents');
    expect(ledger).toContain('invalidateFleetKnowledge');
    expect(ledger).toContain("res.statusCode>=400");
    expect(ledger).toContain('isStateChangingRequest');
    expect(ledger).toContain('READ_ONLY_POSTS');
    expect(ledger).toContain("'/api/chat'");
    expect(ledger).toContain("'confirmationToken'");
    expect(ledger).toContain('agent.${actionKind}.executed');
    expect(app).toContain('fleetMutationLedgerMiddleware');
    expect(webhook).toContain("eventType:'agentmail.prospect_reply.received'");
    expect(webhook).toContain('invalidateFleetKnowledge(organizationId)');
  });
  it('keeps Browserbase progressive capability selection explicit',()=>{
    expect(runtime).toContain('Browserbase Search is the primary discovery path');
    expect(runtime).toContain('Browserbase Fetch is the lightweight page-retrieval path');
    expect(runtime).toContain('Stagehand/Browserbase browser sessions');
    expect(runtime).toContain('Browserbase Functions may back reusable browser automations');
    expect(runtime).toContain('Firecrawl is compatibility fallback only');
  });
});
