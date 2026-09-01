export type AgentSkillStatus = 'active' | 'connected' | 'guarded';

export interface AgentSkill {
  id: string;
  name: string;
  category: 'Cognitive' | 'Execution' | 'Information' | 'Trust & Safety';
  description: string;
  status: AgentSkillStatus;
  confirmationRequired?: boolean;
}

export const AGENT_SKILLS: AgentSkill[] = [
  { id: 'context-memory', name: 'Thread Context Memory', category: 'Cognitive', description: 'Grounds responses in the selected thread, recent inbox, contacts, and upcoming events.', status: 'active' },
  { id: 'predictive-drafting', name: 'Predictive Drafting', category: 'Cognitive', description: 'Anticipates response intent, deadlines, tone, and likely next actions.', status: 'active' },
  { id: 'emotional-intelligence', name: 'Tone & Sentiment Guard', category: 'Cognitive', description: 'Detects urgency, frustration, ambiguity, and relationship risk before drafting.', status: 'active' },
  { id: 'grounded-recall', name: 'Grounded Recall', category: 'Cognitive', description: 'Separates verified context from assumptions and asks when key facts are missing.', status: 'guarded' },
  { id: 'send-email', name: 'Confirmed Email Execution', category: 'Execution', description: 'Sends through the connected AgentMail inbox after a deliberate user click.', status: 'connected', confirmationRequired: true },
  { id: 'calendar-events', name: 'Google Calendar Execution', category: 'Execution', description: 'Reads availability and creates confirmed events in the connected primary calendar.', status: 'connected', confirmationRequired: true },
  { id: 'follow-ups', name: 'Follow-up Planning', category: 'Execution', description: 'Drafts follow-up plans and due dates; durable autonomous delivery remains confirmation-gated.', status: 'guarded', confirmationRequired: true },
  { id: 'bulk-drafting', name: 'Bulk Personalized Drafting', category: 'Execution', description: 'Creates personalized drafts while keeping every outbound batch reviewable.', status: 'guarded', confirmationRequired: true },
  { id: 'inbox-search', name: 'Inbox & Contact Search', category: 'Information', description: 'Searches connected mail and resolves contacts using address plus conversation context.', status: 'connected' },
  { id: 'website-crawl', name: 'Firecrawl Website Research', category: 'Information', description: 'Primary web research tool for searching and crawling supplied public websites and grounding answers in readable page content.', status: process.env.FIRECRAWL_API_KEY ? 'connected' : 'guarded' },
  { id: 'browser-access', name: 'Browserbase Browser Actions', category: 'Execution', description: 'Reserved for explicit live-browser tasks such as navigation, clicking, form entry, authenticated workflows, and future reorder actions.', status: process.env.BROWSERBASE_API_KEY ? 'connected' : 'guarded', confirmationRequired: true },
  { id: 'fleet-context', name: 'Fleet Operations Context', category: 'Information', description: 'Uses vehicles, work orders, maintenance, dispatch, and invoice context when supplied.', status: 'active' },
  { id: 'pii-redaction', name: 'Sensitive Data Redaction', category: 'Trust & Safety', description: 'Redacts SSNs, payment-card patterns, and secrets before model processing.', status: 'active' },
  { id: 'sentinel', name: 'Sentinel Confirmation', category: 'Trust & Safety', description: 'Requires explicit confirmation for sends, replies, forwards, deletes, and calendar writes.', status: 'active', confirmationRequired: true },
];

export function redactSensitiveData(value: string) {
  return value
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED_SSN]')
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, '[REDACTED_PAYMENT_CARD]')
    .replace(/\b(?:api[_-]?key|secret|password|token)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED_SECRET]');
}

export function redactObject(value: unknown): unknown {
  if (typeof value === 'string') return redactSensitiveData(value);
  if (Array.isArray(value)) return value.map(redactObject);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactObject(item)]));
  return value;
}

export function formatAgentPlainText(value: string) {
  return value
    .replace(/```json:(?:email_draft|agent_action)[\s\S]*?```/gi, '')
    .replace(/```[a-z]*\s*([\s\S]*?)```/gi, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/^\s*---+\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
