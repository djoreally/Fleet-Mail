import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { planAgentTools } from '../src/server/services/agentToolRouter.js';
import { formatAgentPlainText } from '../src/server/services/agentSkills.js';

describe('Fleet Agent capability certification', () => {
  describe('capability awareness and deterministic routing', () => {
    const cases = [
      ['Do you know who Zachary is?', 'none', ['contacts.search', 'prospects.search', 'fleetAccounts.search', 'email.search']],
      ['Which vehicles are overdue for maintenance?', 'none', ['vehicles.search', 'maintenance.search']],
      ['Show work order WO-218 inspection and authorization status', 'none', ['workOrders.search', 'inspections.search', 'authorizations.search']],
      ['Show unpaid invoices and payment aging', 'none', ['invoices.search', 'payments.search', 'financials.search']],
      ['Find the inspection PDF attachment for Unit 21', 'none', ['documents.search', 'inspections.search', 'vehicles.search']],
      ['Research Acme Plumbing online', 'research', []],
      ['Search the web for plumbers in Ambler PA', 'research', []],
      ['Find a new company in 19002 for prospecting', 'research', []],
      ['Open https://example.com and inspect the vendor page', 'browse', []],
      ['Fill out the vendor registration form at https://example.com/vendor', 'form', []],
      ['Download the PDF from https://example.com/receipt.pdf', 'document', []],
    ] as const;

    for (const [prompt, webCapability, requiredTools] of cases) {
      it(`routes: ${prompt}`, () => {
        const plan = planAgentTools(prompt);
        expect(plan.webCapability).toBe(webCapability);
        expect(plan.readTools).toEqual(expect.arrayContaining([...requiredTools]));
      });
    }

    it('keeps internal Fleet/company questions off the public web unless web research is explicit', () => {
      expect(planAgentTools('Show me Acme Fleet account details').webCapability).toBe('none');
      expect(planAgentTools('What emails do we have with Acme?').webCapability).toBe('none');
      expect(planAgentTools('Who manages Unit 230?').webCapability).toBe('none');
    });

    it('does not treat a search-engine URL as a substitute for a research query', () => {
      const plan = planAgentTools('Search the web for plumbers in Ambler');
      expect(plan.webCapability).toBe('research');
      expect(plan.webMode).toBe('research');
    });
  });

  describe('visible-output safety', () => {
    it('removes raw and encoded provider/tool-call markup from user-visible text', () => {
      const dirty = [
        'Before',
        '<dots_function_call>{"name":"browserResearch"}</dots_function_call>',
        '<function_calls><invoke name="search">secret</invoke></function_calls>',
        '&lt;tool_call&gt;hidden&lt;/tool_call&gt;',
        'tool_call: {"url":"https://example.com"}',
        'After',
      ].join('\n');
      const clean = formatAgentPlainText(dirty);
      expect(clean).not.toMatch(/dots_function_call|function_calls?|tool_calls?|<invoke|browserResearch/i);
      expect(clean).toContain('Before');
      expect(clean).toContain('After');
    });

    it('removes hidden email/action review payloads from visible text', () => {
      const clean = formatAgentPlainText('Visible\n```json:agent_action\n{"kind":"workOrder.create","payload":{}}\n```\n```json:email_draft\n{"to":"x@example.com"}\n```');
      expect(clean).toBe('Visible');
    });
  });

  describe('execution truth and confirmation boundaries', () => {
    const chat = readFileSync('src/server/routes/chat.ts', 'utf8');
    const webRouter = readFileSync('src/server/services/webCapabilityRouter.ts', 'utf8');

    it('requires actual web execution success before the agent may claim success', () => {
      expect(chat).toContain('A web action succeeded only when Authenticated Fleet context.web.status is "success"');
      expect(chat).toContain('If it is "failed" or "blocked"');
      expect(chat).toContain('do not fabricate page content');
      expect(webRouter).toContain("status: 'failed'");
      expect(webRouter).toContain("status: 'blocked'");
    });

    it('keeps consequential mutations confirmation-gated', () => {
      expect(chat).toContain('Never claim an email, calendar event, browser submission, payment, invoice, schedule, dispatch, authorization, prospect conversion, or work-order change executed unless a confirmed executor returned success.');
      expect(chat).toContain('Browser form work is prepare-only unless a separate confirmed executor reports submission success.');
      expect(chat).toContain('createAgentActionProposal');
    });

    it('keeps provider choice server-owned and excludes raw provider invocation syntax from the model contract', () => {
      expect(webRouter).toContain('async function researchWithFallback');
      expect(webRouter.indexOf('process.env.BROWSERBASE_API_KEY')).toBeLessThan(webRouter.indexOf('process.env.FIRECRAWL_API_KEY'));
      expect(chat).toContain('The runtime owns web execution. You do not choose or invoke providers yourself.');
      expect(chat).toContain('Never emit provider commands, tool-call markup');
    });

    it('keeps Browserbase REST-first research with Firecrawl compatibility fallback', () => {
      expect(webRouter).toContain('searchWithBrowserbase');
      expect(webRouter).toContain('process.env.BROWSERBASE_API_KEY');
      expect(webRouter).toContain('process.env.FIRECRAWL_API_KEY');
      expect(webRouter).not.toContain('client().search.web');
      expect(webRouter).not.toContain('client().fetchAPI.create');
    });
  });
});
