import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createAgentActionProposal, normalizeAgentAction, verifyAgentActionProposal } from './agentActions.js';

describe('agent action confirmation contract', () => {
  const previous = process.env.AGENT_ACTION_SECRET;

  beforeEach(() => { process.env.AGENT_ACTION_SECRET = 'test-agent-action-secret-at-least-24-characters'; });
  afterEach(() => { process.env.AGENT_ACTION_SECRET = previous; });

  it('creates and verifies an exact email proposal', () => {
    const created = createAgentActionProposal('email.send', { to: 'ops@example.com', subject: 'Unit 214', body: 'Ready for pickup.' }, 'org_1');
    expect(verifyAgentActionProposal(created.confirmationToken)).toMatchObject({
      id: created.proposal.id,
      kind: 'email.send',
      organizationId: 'org_1',
      payload: { to: 'ops@example.com', subject: 'Unit 214', text: 'Ready for pickup.' },
    });
  });

  it('rejects tampered confirmation tokens', () => {
    const created = createAgentActionProposal('email.send', { to: 'ops@example.com', subject: 'Unit 214', body: 'Ready.' }, 'org_1');
    expect(() => verifyAgentActionProposal(`${created.confirmationToken}changed`)).toThrow('changed');
  });

  it('normalizes confirmed customer and work-order actions', () => {
    expect(normalizeAgentAction('contact.create', { email: 'ops@acme.test' })).toMatchObject({ kind: 'contact.create', payload: { name: 'ops', email: 'ops@acme.test' } });
    expect(normalizeAgentAction('customer.create', { name: 'Acme Fleet' })).toMatchObject({ kind: 'customer.create', payload: { name: 'Acme Fleet' } });
    expect(normalizeAgentAction('work-order.delete', { id: 'wo_1' })).toMatchObject({ kind: 'work-order.delete', payload: { id: 'wo_1' } });
  });

  it('normalizes a calendar proposal to Google Calendar format', () => {
    const action = normalizeAgentAction('calendar.create', {
      title: 'PM service', start: '2026-09-01T14:00:00Z', end: '2026-09-01T15:00:00Z', attendees: ['fleet@example.com'],
    });
    expect(action.payload).toMatchObject({
      summary: 'PM service',
      start: { dateTime: '2026-09-01T14:00:00.000Z' },
      attendees: [{ email: 'fleet@example.com' }],
    });
  });
});
