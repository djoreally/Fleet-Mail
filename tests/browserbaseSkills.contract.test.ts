import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { planAgentTools } from '../src/server/services/agentToolRouter.js';

describe('Browserbase skills and Fleet identity routing contract', () => {
  it('treats a person/name question as an internal FleetOS lookup', () => {
    const plan = planAgentTools('Do you know who Zachary is?');
    expect(plan.webCapability).toBe('none');
    expect(plan.readTools).toContain('contacts.search');
    expect(plan.readTools).toContain('fleetAccounts.search');
    expect(plan.readTools).toContain('email.search');
  });

  it('treats fleet client account language as Fleet Account context', () => {
    const plan = planAgentTools('Show me the fleet client account for Acme Plumbing');
    expect(plan.webCapability).toBe('none');
    expect(plan.readTools).toContain('fleetAccounts.search');
    expect(plan.readTools).toContain('contacts.search');
    expect(plan.readTools).toContain('vehicles.search');
    expect(plan.readTools).toContain('workOrders.search');
  });

  it('uses Browserbase Search through the REST API, not a nonexistent SDK search method', () => {
    const browser = readFileSync('src/server/services/browserbase.ts', 'utf8');
    expect(browser).toContain("const BROWSERBASE_API_BASE = 'https://api.browserbase.com/v1'");
    expect(browser).toContain('`${BROWSERBASE_API_BASE}/search`');
    expect(browser).toContain("'X-BB-API-Key': apiKey()");
    expect(browser).not.toContain('client().search.web');
  });

  it('keeps REST Fetch for static retrieval and Stagehand for browser interaction', () => {
    const browser = readFileSync('src/server/services/browserbase.ts', 'utf8');
    expect(browser).toContain('`${BROWSERBASE_API_BASE}/fetch`');
    expect(browser).not.toContain('client().fetchAPI.create');
    expect(browser).toContain('Browserbase Fetch returned no readable content');
    expect(browser).toContain('browserbase.launch');
    expect(browser).toContain('Stagehand.create');
  });

  it('searches organization members and technicians when resolving names', () => {
    const runtime = readFileSync('src/server/services/agentRuntimeSearch.ts', 'utf8');
    expect(runtime).toContain('organizationMemberships');
    expect(runtime).toContain('technicians');
    expect(runtime).toContain('organizationMembers:memberRows');
    expect(runtime).toContain('technicians:technicianRows');
  });
});
