import { describe, expect, it } from 'vitest';
import { AGENT_READ_TOOL_CATALOG, planAgentTools } from '../src/server/services/agentToolRouter.js';

describe('Fleet agent tool router', () => {
  it('publishes the complete deterministic Fleet OS read catalog', () => {
    expect(AGENT_READ_TOOL_CATALOG).toEqual(expect.arrayContaining([
      'fleetAccounts.search', 'vehicles.search', 'contacts.search', 'locations.search',
      'maintenance.search', 'workOrders.search', 'schedule.search', 'dispatch.search',
      'inspections.search', 'authorizations.search', 'financials.search',
      'invoices.search', 'payments.search', 'prospects.search',
      'prospectActivity.search', 'email.search', 'documents.search',
    ]));
  });

  it('routes contact and email questions to relationship sources', () => {
    const plan = planAgentTools('Find Zachary at Reynolds and show me our emails with him');
    expect(plan.readTools).toEqual(expect.arrayContaining(['contacts.search', 'prospects.search', 'fleetAccounts.search', 'email.search']));
  });

  it('routes a work order through its operational dependencies', () => {
    const plan = planAgentTools('Show work order WO-218 inspection, authorization, dispatch and invoice status');
    expect(plan.readTools).toEqual(expect.arrayContaining([
      'workOrders.search', 'schedule.search', 'dispatch.search',
      'inspections.search', 'authorizations.search', 'invoices.search',
    ]));
  });

  it('routes finance, payment, and document requests', () => {
    expect(planAgentTools('Show unpaid invoices and payment aging').readTools).toEqual(expect.arrayContaining(['invoices.search', 'payments.search', 'financials.search']));
    expect(planAgentTools('Find the inspection PDF attachment for Unit 21').readTools).toEqual(expect.arrayContaining(['documents.search', 'inspections.search', 'vehicles.search']));
  });

  it('uses one simple web capability contract', () => {
    expect(planAgentTools('Research https://example.com for fleet information')).toMatchObject({ webMode: 'research', webCapability: 'research' });
    expect(planAgentTools('Search the web for plumbing companies in Ambler')).toMatchObject({ webMode: 'research', webCapability: 'research' });
    expect(planAgentTools('Open https://example.com and inspect the vendor page')).toMatchObject({ webMode: 'browser', webCapability: 'browse' });
    expect(planAgentTools('Fill out the vendor registration form at https://example.com/vendor')).toMatchObject({ webMode: 'browser', webCapability: 'form' });
    expect(planAgentTools('Download the PDF from https://example.com/receipt.pdf')).toMatchObject({ webMode: 'browser', webCapability: 'document' });
  });

  it('does not treat a plain company question as a browser task', () => {
    expect(planAgentTools('Show me Acme Fleet account details').webCapability).toBe('none');
  });
});
