import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const knowledge = readFileSync('src/server/services/fleetKnowledge.ts','utf8');
const runtime = readFileSync('src/server/services/fleetAgentRuntime.ts','utf8');
const ledger = readFileSync('src/server/services/fleetMutationLedger.ts','utf8');
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
    expect(knowledge).toContain('levenshtein');
    expect(knowledge).toContain('similarity');
    expect(runtime).toContain('getFleetKnowledgeContext');
    expect(runtime).toContain('Never say you lack a search function');
  });
  it('uses the canonical audit_events ledger and invalidates cached knowledge after successful writes',()=>{
    expect(ledger).toContain('auditEvents');
    expect(ledger).toContain('invalidateFleetKnowledge');
    expect(ledger).toContain("res.statusCode>=400");
    expect(ledger).toContain("MUTATING_METHODS");
    expect(app).toContain('fleetMutationLedgerMiddleware');
  });
  it('keeps Browserbase progressive capability selection explicit',()=>{
    expect(runtime).toContain('Browserbase Search is the primary discovery path');
    expect(runtime).toContain('Browserbase Fetch is the lightweight page-retrieval path');
    expect(runtime).toContain('Stagehand/Browserbase browser sessions');
    expect(runtime).toContain('Browserbase Functions may back reusable browser automations');
    expect(runtime).toContain('Firecrawl is compatibility fallback only');
  });
});
