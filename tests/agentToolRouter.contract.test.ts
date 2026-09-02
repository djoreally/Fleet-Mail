import { describe, expect, it } from 'vitest';
import { planAgentTools } from '../src/server/services/agentToolRouter.js';

describe('Fleet agent tool router', () => {
  it('routes contact and email questions to relationship sources', () => {
    const plan = planAgentTools('Find Zachary at Reynolds and show me our emails with him');
    expect(plan.readTools).toContain('contacts.search');
    expect(plan.readTools).toContain('prospects.search');
    expect(plan.readTools).toContain('fleetAccounts.search');
    expect(plan.readTools).toContain('email.search');
  });

  it('routes maintenance questions to vehicle, PM, and work order sources', () => {
    const plan = planAgentTools('What maintenance is due for Unit 218?');
    expect(plan.readTools).toContain('vehicles.search');
    expect(plan.readTools).toContain('maintenance.search');
    expect(plan.readTools).toContain('workOrders.search');
  });

  it('uses research mode for web research and browser mode only for explicit interaction', () => {
    expect(planAgentTools('Research https://example.com for fleet information').webMode).toBe('research');
    expect(planAgentTools('Open the website and fill out the vendor registration form').webMode).toBe('browser');
  });
});
