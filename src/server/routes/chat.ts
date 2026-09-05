import { Router } from 'express';
import { getAgentMailClient } from '../services/agentmail.js';
import { AGENT_SKILLS, formatAgentPlainText, redactObject, redactSensitiveData } from '../services/agentSkills.js';
import { planAgentTools, type AgentToolPlan } from '../services/agentToolRouter.js';
import { decodeVin, isValidVin, normalizeVin } from '../services/nhtsa.js';
import { requireFleetOrganization } from '../services/fleetAuth.js';
import { runFleetAgentToolLoop } from '../services/fleetAgentLoop.js';

export const tenantChatRouter = Router();

function mailAddress(value: unknown) {
  if (Array.isArray(value)) return value.map(mailAddress).filter(Boolean).join(', ');
  if (value && typeof value === 'object') {
    const item = value as Record<string, unknown>;
    return String(item.email || item.address || item.value || item.name || '');
  }
  return String(value || '');
}

function extractVins(text: string) {
  const candidates = text.toUpperCase().match(/\b[A-HJ-NPR-Z0-9]{17}\b/g) || [];
  return [...new Set(candidates.map(normalizeVin).filter(isValidVin))].slice(0, 12);
}

tenantChatRouter.post('/', async (req, res) => {
  try {
    const activeInbox = String(res.locals.agentMailInbox || '').trim();
    if (!activeInbox) return res.status(401).json({ error: 'A verified organization-scoped AgentMail inbox is required' });
    const organizationId = await requireFleetOrganization(req);

    const { messages, activeEmail, personality = 'Professional' } = req.body;
    const rawAttachments = Array.isArray(req.body?.attachments) ? req.body.attachments.slice(0, 4) : [];
    const attachments = rawAttachments.map((file: any) => ({
      name: String(file?.name || 'attachment').slice(0, 180),
      type: String(file?.type || 'application/octet-stream').slice(0, 100),
      kind: file?.kind === 'image' ? 'image' : 'document',
      text: typeof file?.text === 'string' ? redactSensitiveData(file.text.slice(0, 20_000)) : '',
      dataUrl: typeof file?.dataUrl === 'string' && /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(file.dataUrl) ? file.dataUrl : '',
      extractionError: typeof file?.extractionError === 'string' ? file.extractionError.slice(0, 500) : '',
    }));

    let recentInbox: any[] = [];
    try {
      const mail = await getAgentMailClient()?.inboxes.messages.list(activeInbox, { limit: 12 });
      recentInbox = (mail?.messages || []).map((item: any) => ({
        from: mailAddress(item.from),
        to: mailAddress(item.to),
        subject: String(item.subject || ''),
        preview: String(item.text || item.preview || item.snippet || '').slice(0, 500),
        createdAt: item.createdAt || item.created_at,
      }));
    } catch (error) {
      console.warn('Tenant AgentMail grounding unavailable:', error instanceof Error ? error.message : error);
    }

    const latestUserText = String([...(Array.isArray(messages) ? messages : [])].reverse().find((message: any) => message?.role === 'user')?.content || '');
    const emailVehicleText = [activeEmail?.text, activeEmail?.html, activeEmail?.subject].filter(Boolean).join('\n');
    const attachmentText = attachments.map((file: any) => file.text || '').join('\n');
    const vins = extractVins(`${latestUserText}\n${emailVehicleText}\n${attachmentText}`);
    const nhtsaVehicles = [];
    for (const vin of vins) {
      try {
        nhtsaVehicles.push(await decodeVin({ vin }));
      } catch (error) {
        nhtsaVehicles.push({ vin, valid: false, error: error instanceof Error ? error.message : 'VIN decode failed' });
      }
    }

    const toolPlan = (req.body?.agentToolPlan && typeof req.body.agentToolPlan === 'object'
      ? req.body.agentToolPlan
      : planAgentTools(latestUserText)) as AgentToolPlan;

    const groundedContext = redactObject({
      activeInbox,
      selectedEmail: activeEmail || null,
      recentInbox,
      suggestedFleetToolPlan: { readTools: toolPlan.readTools, webCapability: toolPlan.webCapability },
      vehicleIntelligence: { source: 'NHTSA vPIC', decoded: nhtsaVehicles },
      attachedDocuments: attachments.filter((file: any) => file.text || file.extractionError).map((file: any) => ({
        name: file.name,
        type: file.type,
        text: file.text,
        extractionError: file.extractionError || undefined,
      })),
    });

    const systemPrompt = `You are the Fleet OS agent. Work like a capable service-writer/operator: understand the request, use the controlled tools you are given, inspect their structured results, and continue using tools when another lookup is required before answering.
Use the authenticated organization context supplied by the server. Never infer tenant identity from user text or an inbox supplied by the user.
When a request depends on current Fleet records, use the organization-scoped Fleet tools. Do not claim you lack a search function, database access, contact access, vehicle access, work-order access, financial access, email access, or document access merely because the information was not preloaded. Search for it.
Read-only tools may run automatically. Their results are authoritative only for the authenticated organization. Tool results may be empty; empty results mean no matching organization-scoped record was found, not that the tool does not exist.
You may chain multiple read tools across up to five bounded rounds when needed, for example person → account → vehicles → work orders → invoice → email. Prefer canonical IDs returned by tools over names when linking records.
Consequential mutations are NEVER automatic. Email, calendar, work-order mutations, authorization decisions, and prospect conversion are prepared for explicit confirmation and are not complete until the confirmation-gated executor reports success.
Use the user's preferred ${personality} tone. Ground names, facts, deadlines, and claims in trusted context or actual tool results. Clearly label assumptions and never invent search results or execution success.
Vehicle VIN intelligence comes from NHTSA vPIC. Use it before open-web research for VIN decoding.
Public-web research uses the approved server-owned Browserbase capability tools. Interactive browser/form work never authorizes consequential submission. Do not narrate provider selection.
Never emit provider commands, tool-call markup, XML-like function calls, JSON tool payloads, implementation names, database internals, or routing details in visible text.
The visible response must be plain human-readable text without Markdown headings, tables, fenced code, raw tool syntax, or provider jargon.

Authenticated Fleet context: ${JSON.stringify(groundedContext)}`;

    const safeMessages = (Array.isArray(messages) ? messages : []).map((message: any) => ({
      ...message,
      content: typeof message.content === 'string' ? redactSensitiveData(message.content) : message.content,
    }));
    const imageParts = attachments.filter((file: any) => file.dataUrl).map((file: any) => ({ type: 'image_url' as const, image_url: { url: file.dataUrl } }));
    if (imageParts.length && safeMessages.length) {
      let latest = safeMessages.length - 1;
      while (latest >= 0 && safeMessages[latest]?.role !== 'user') latest -= 1;
      if (latest >= 0) {
        const text = typeof safeMessages[latest].content === 'string' ? safeMessages[latest].content : '';
        safeMessages[latest] = { ...safeMessages[latest], content: [{ type: 'text' as const, text }, ...imageParts] };
      }
    }

    const agentResult = await runFleetAgentToolLoop({ organizationId, messages: safeMessages, systemPrompt, latestUserText });
    const webResult = agentResult.webExecution;

    let emailDraft = null;
    if (agentResult.actionProposal?.kind === 'email.send') {
      const payload = agentResult.actionProposal.payload as Record<string, unknown>;
      emailDraft = { to: payload.to, subject: payload.subject, body: payload.text };
    }

    return res.json({
      content: formatAgentPlainText(agentResult.content),
      model: agentResult.model,
      provider: agentResult.provider,
      emailDraft,
      actionProposal: agentResult.actionProposal,
      toolPlan: { readTools: toolPlan.readTools, webCapability: toolPlan.webCapability },
      toolExecution: { rounds: agentResult.rounds, trace: agentResult.toolTrace },
      vehicleIntelligence: nhtsaVehicles,
      webExecution: webResult ? {
        capability: webResult.capability,
        provider: webResult.provider,
        status: webResult.status,
        sourceUrls: webResult.sourceUrls,
        error: webResult.error,
        durationMs: webResult.durationMs,
        sessionId: webResult.sessionId,
        cacheStatus: webResult.cacheStatus,
      } : null,
      skillsUsed: [
        ...AGENT_SKILLS.filter((skill: any) => typeof skill === 'string').slice(0, 0),
        'tenant-grounding', 'context-memory', 'bounded-tool-loop', 'predictive-drafting', 'grounded-recall',
        ...(agentResult.toolTrace.length ? ['iterative-tool-use'] : []),
        ...(nhtsaVehicles.length ? ['nhtsa-vin-decode'] : []),
        ...(webResult?.status === 'success' ? [`web:${webResult.capability}`] : []),
        'pii-redaction', 'sentinel',
      ],
    });
  } catch (error) {
    console.error('Tenant chat error:', error instanceof Error ? error.message : error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to process chat request' });
  }
});
