import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createAgentActionProposal, normalizeAgentAction, verifyAgentActionProposal } from './agentActions.js';

describe('agent action confirmation contract', () => {
  const previous = process.env.AGENT_ACTION_SECRET;

  beforeEach(() => { process.env.AGENT_ACTION_SECRET = 'test-agent-action-secret-at-least-24-characters'; });
  afterEach(() => { process.env.AGENT_ACTION_SECRET = previous; });

  it('creates and verifies an exact email proposal', () => {
    const created = createAgentActionProposal('email.send', { to: 'ops@example.com', subject: 'Unit 214', body: 'Ready for pickup.' });
    expect(verifyAgentActionProposal(created.confirmationToken)).toMatchObject({
      id: created.proposal.id,
      kind: 'email.send',
      payload: { to: 'ops@example.com', subject: 'Unit 214', text: 'Ready for pickup.' },
    });
  });

  it('rejects tampered confirmation tokens', () => {
    const created = createAgentActionProposal('email.send', { to: 'ops@example.com', subject: 'Unit 214', body: 'Ready.' });
    expect(() => verifyAgentActionProposal(`${created.confirmationToken}changed`)).toThrow('changed');
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
