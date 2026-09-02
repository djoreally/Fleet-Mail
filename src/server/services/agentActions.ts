import crypto from 'node:crypto';

export type AgentActionKind =
  | 'email.send'
  | 'calendar.create'
  | 'fleet.work_order.create'
  | 'fleet.work_order.transition'
  | 'fleet.authorization.decision'
  | 'fleet.prospect.convert';

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
function optionalText(value: unknown, max = 10_000) {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, max) : undefined;
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
function optionalNumber(value: unknown, name: string) {
  if (value === undefined || value === null || value === '') return undefined;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error(`${name} must be zero or greater`);
  return number;
}

export function normalizeAgentAction(kind: unknown, raw: unknown): { kind: AgentActionKind; payload: Record<string, unknown>; summary: string } {
  const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  if (kind === 'email.send') {
    const payload = {
      to: email(source.to),
      subject: requiredText(source.subject, 'Subject', 998),
      text: requiredText(source.text ?? source.body, 'Email body', 100_000),
      prospectId: optionalText(source.prospectId, 100),
      contactId: optionalText(source.contactId, 100),
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
      description: optionalText(source.description, 20_000), location: optionalText(source.location, 1_000),
      start: { dateTime: start }, end: { dateTime: end }, attendees: attendees.map((address) => ({ email: address })),
    };
    return { kind, payload, summary: `Create “${payload.summary}” on ${new Date(start).toLocaleString('en-US', { timeZone: 'UTC' })} UTC` };
  }
  if (kind === 'fleet.work_order.create') {
    const payload = {
      vehicleId: requiredText(source.vehicleId, 'Vehicle', 100),
      complaint: requiredText(source.complaint ?? source.requestedService, 'Requested service', 2_000),
      requestedServices: Array.isArray(source.requestedServices) ? source.requestedServices.slice(0, 30).map((item) => String(item).trim()).filter(Boolean) : optionalText(source.requestedServices, 2_000),
      purchaseOrderNumber: optionalText(source.purchaseOrderNumber, 100),
      odometer: optionalNumber(source.odometer, 'Odometer'), engineHours: optionalNumber(source.engineHours, 'Engine hours'),
      scheduledAt: source.scheduledAt ? isoDate(source.scheduledAt, 'Scheduled time') : undefined,
      priority: optionalText(source.priority, 30) ?? 'routine', customerNotes: optionalText(source.customerNotes, 2_000), technicianNotes: optionalText(source.technicianNotes, 2_000),
    };
    return { kind, payload, summary: `Create a work order for vehicle ${payload.vehicleId}: ${payload.complaint}` };
  }
  if (kind === 'fleet.work_order.transition') {
    const payload = { workOrderId: requiredText(source.workOrderId, 'Work order', 100), status: requiredText(source.status, 'Status', 60) };
    return { kind, payload, summary: `Move work order ${payload.workOrderId} to ${payload.status.replaceAll('_', ' ')}` };
  }
  if (kind === 'fleet.authorization.decision') {
    const decision = requiredText(source.decision, 'Decision', 20);
    if (!['authorized','rejected'].includes(decision)) throw new Error('Decision must be authorized or rejected');
    const payload = {
      authorizationId: requiredText(source.authorizationId, 'Authorization', 100), decision,
      authorizedBy: optionalText(source.authorizedBy, 200), authorizationMethod: optionalText(source.authorizationMethod, 80),
      purchaseOrderNumber: optionalText(source.purchaseOrderNumber, 100), notes: optionalText(source.notes, 2_000),
    };
    return { kind, payload, summary: `${decision === 'authorized' ? 'Approve' : 'Reject'} authorization ${payload.authorizationId}` };
  }
  if (kind === 'fleet.prospect.convert') {
    const payload = { prospectId: requiredText(source.prospectId, 'Prospect', 100) };
    return { kind, payload, summary: `Convert prospect ${payload.prospectId} into a Fleet Account` };
  }
  throw new Error('Unsupported agent action');
}

export function createAgentActionProposal(kind: unknown, payload: unknown) {
  const normalized = normalizeAgentAction(kind, payload);
  const now = Date.now();
  const proposal: AgentActionProposal = { id: crypto.randomUUID(), ...normalized, createdAt: new Date(now).toISOString(), expiresAt: new Date(now + 10 * 60_000).toISOString() };
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
  const validationPayload = proposal.kind === 'calendar.create' ? {
    ...proposal.payload,
    start: (proposal.payload.start as any)?.dateTime,
    end: (proposal.payload.end as any)?.dateTime,
    attendees: Array.isArray(proposal.payload.attendees) ? (proposal.payload.attendees as any[]).map((item) => item.email) : [],
  } : proposal.payload;
  normalizeAgentAction(proposal.kind, validationPayload);
  return proposal;
}
