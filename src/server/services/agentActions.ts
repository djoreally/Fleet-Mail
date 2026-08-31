import crypto from 'node:crypto';

export type AgentActionKind = 'email.send' | 'calendar.create';

export interface AgentActionProposal {
  id: string;
  kind: AgentActionKind;
  summary: string;
  payload: Record<string, unknown>;
  createdAt: string;
  expiresAt: string;
}

function signingKey() {
  const secret = process.env.AGENT_ACTION_SECRET || process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!secret || secret.length < 24) throw new Error('Agent action signing is not configured');
  return crypto.createHash('sha256').update(secret).digest();
}

function requiredText(value: unknown, name: string, max = 10_000) {
  const text = String(value || '').trim();
  if (!text) throw new Error(`${name} is required`);
  if (text.length > max) throw new Error(`${name} is too long`);
  return text;
}

function email(value: unknown) {
  const text = requiredText(value, 'Recipient', 320);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) throw new Error('Recipient must be a valid email address');
  return text;
}

function isoDate(value: unknown, name: string) {
  const text = requiredText(value, name, 64);
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw new Error(`${name} must be a valid date and time`);
  return date.toISOString();
}

export function normalizeAgentAction(kind: unknown, raw: unknown): { kind: AgentActionKind; payload: Record<string, unknown>; summary: string } {
  const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  if (kind === 'email.send') {
    const payload = {
      to: email(source.to),
      subject: requiredText(source.subject, 'Subject', 998),
      text: requiredText(source.text ?? source.body, 'Email body', 100_000),
    };
    return { kind, payload, summary: `Send “${payload.subject}” to ${payload.to}` };
  }
  if (kind === 'calendar.create') {
    const start = isoDate(source.start, 'Start');
    const end = isoDate(source.end, 'End');
    if (new Date(end) <= new Date(start)) throw new Error('End must be after start');
    const attendees = Array.isArray(source.attendees) ? source.attendees.slice(0, 50).map(email) : [];
    const payload = {
      summary: requiredText(source.summary ?? source.title, 'Event title', 1_000),
      description: source.description ? String(source.description).slice(0, 20_000) : undefined,
      location: source.location ? String(source.location).slice(0, 1_000) : undefined,
      start: { dateTime: start },
      end: { dateTime: end },
      attendees: attendees.map((address) => ({ email: address })),
    };
    return { kind, payload, summary: `Create “${payload.summary}” on ${new Date(start).toLocaleString('en-US', { timeZone: 'UTC' })} UTC` };
  }
  throw new Error('Unsupported agent action');
}

export function createAgentActionProposal(kind: unknown, payload: unknown) {
  const normalized = normalizeAgentAction(kind, payload);
  const now = Date.now();
  const proposal: AgentActionProposal = {
    id: crypto.randomUUID(),
    ...normalized,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 10 * 60_000).toISOString(),
  };
  const encoded = Buffer.from(JSON.stringify(proposal)).toString('base64url');
  const signature = crypto.createHmac('sha256', signingKey()).update(encoded).digest('base64url');
  return { proposal, confirmationToken: `${encoded}.${signature}` };
}

export function verifyAgentActionProposal(token: unknown): AgentActionProposal {
  const [encoded, signature] = String(token || '').split('.');
  if (!encoded || !signature) throw new Error('A valid confirmation token is required');
  const expected = crypto.createHmac('sha256', signingKey()).update(encoded).digest();
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) throw new Error('The action proposal was changed');
  const proposal = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as AgentActionProposal;
  if (new Date(proposal.expiresAt).getTime() < Date.now()) throw new Error('The action proposal expired; review it again');
  normalizeAgentAction(proposal.kind, proposal.kind === 'calendar.create' ? {
    ...proposal.payload,
    start: (proposal.payload.start as any)?.dateTime,
    end: (proposal.payload.end as any)?.dateTime,
    attendees: Array.isArray(proposal.payload.attendees) ? (proposal.payload.attendees as any[]).map((item) => item.email) : [],
  } : proposal.payload);
  return proposal;
}
