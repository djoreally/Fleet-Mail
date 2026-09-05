import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createAgentActionProposal, normalizeAgentAction, verifyAgentActionProposal } from './agentActions.js';

describe('agent action confirmation contract', () => {
  const previous = process.env.AGENT_ACTION_SECRET;
  const organizationId = 'org-test-1';

  beforeEach(() => { process.env.AGENT_ACTION_SECRET = 'test-agent-action-secret-at-least-24-characters'; });
  afterEach(() => { process.env.AGENT_ACTION_SECRET = previous; });

  it('creates and verifies an exact tenant-bound email proposal', () => {
    const created = createAgentActionProposal('email.send', { to: 'ops@example.com', subject: 'Unit 214', body: 'Ready for pickup.' }, organizationId);
    expect(verifyAgentActionProposal(created.confirmationToken, organizationId)).toMatchObject({
      id: created.proposal.id,
      organizationId,
      kind: 'email.send',
      payload: { to: 'ops@example.com', subject: 'Unit 214', text: 'Ready for pickup.' },
    });
  });

  it('rejects a proposal in a different Fleet organization', () => {
    const created = createAgentActionProposal('email.send', { to: 'ops@example.com', subject: 'Unit 214', body: 'Ready.' }, organizationId);
    expect(() => verifyAgentActionProposal(created.confirmationToken, 'org-test-2')).toThrow('does not belong');
  });

  it('preserves prospect linkage inside the signed email proposal', () => {
    const created = createAgentActionProposal('email.send', {
      to: 'fleet@example.com', subject: 'Onsite fleet maintenance', body: 'Would Tuesday work?', prospectId: 'prospect-1', contactId: 'contact-1',
    }, organizationId);
    expect(verifyAgentActionProposal(created.confirmationToken, organizationId).payload).toMatchObject({
      to: 'fleet@example.com', prospectId: 'prospect-1', contactId: 'contact-1',
    });
  });

  it('rejects tampered confirmation tokens', () => {
    const created = createAgentActionProposal('email.send', { to: 'ops@example.com', subject: 'Unit 214', body: 'Ready.' }, organizationId);
    expect(() => verifyAgentActionProposal(`${created.confirmationToken}changed`, organizationId)).toThrow('changed');
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

  it('signs a prospect conversion proposal without executing it', () => {
    const created = createAgentActionProposal('fleet.prospect.convert', { prospectId: 'prospect-42' }, organizationId);
    expect(verifyAgentActionProposal(created.confirmationToken, organizationId)).toMatchObject({
      organizationId,
      kind: 'fleet.prospect.convert', payload: { prospectId: 'prospect-42' },
    });
  });
});
