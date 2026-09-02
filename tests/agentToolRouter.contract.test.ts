import { describe, expect, it } from 'vitest';
import { planAgentTools } from '../src/server/services/agentToolRouter';

describe('Fleet agent tool router', () => {
  it('routes a named contact lookup to CRM and email search', () => {
    const plan = planAgentTools('Find Zachary at Reynolds and show me our emails with him');
    expect(plan.readTools).toContain('contacts.search');
    expect(plan.readTools).toContain('prospects.search');
    expect(plan.readTools).toContain('fleetAccounts.search');
    expect(plan.readTools).toContain('email.search');
  });

  it('routes vehicle maintenance questions to operational sources', () => {
    const plan = planAgentTools('What maintenance is due for Unit 218?');
    expect(plan.readTools).toContain('vehicles.search');
    expect(plan.readTools).toContain('maintenance.search');
    expect(plan.readTools).toContain('workOrders.search');
  });

  it('uses Firecrawl research mode for normal web research', () => {
    expect(planAgentTools('Research https://example.com for fleet information').webMode).toBe('research');
  });

  it('reserves browser mode for explicit browser interaction', () => {
    expect(planAgentTools('Open the website and fill out the vendor registration form').webMode).toBe('browser');
  });
});
