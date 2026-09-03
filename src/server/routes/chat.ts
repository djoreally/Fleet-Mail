import { Router } from 'express';
import { callAICompletion } from '../services/ai.js';
import { getAgentMailClient } from '../services/agentmail.js';
import { AGENT_SKILLS, formatAgentPlainText, redactObject, redactSensitiveData } from '../services/agentSkills.js';
import { createAgentActionProposal } from '../services/agentActions.js';
import { crawlWebsite, extractWebsiteUrl } from '../services/firecrawl.js';

export const tenantChatRouter = Router();

function mailAddress(value: unknown) {
  if (Array.isArray(value)) return value.map(mailAddress).filter(Boolean).join(', ');
  if (value && typeof value === 'object') {
    const item = value as Record<string, unknown>;
    return String(item.email || item.address || item.value || item.name || '');
  }
  return String(value || '');
}

tenantChatRouter.post('/', async (req, res) => {
  try {
    const activeInbox = String(res.locals.agentMailInbox || '').trim();
    if (!activeInbox) return res.status(401).json({ error: 'A verified organization-scoped AgentMail inbox is required' });

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

    const latestUserText = [...(Array.isArray(messages) ? messages : [])].reverse().find((message: any) => message?.role === 'user')?.content || '';
    const websiteUrl = extractWebsiteUrl(String(latestUserText));
    let websiteResearch = null;
    if (websiteUrl) {
      if (!process.env.FIRECRAWL_API_KEY?.trim()) throw new Error('Website research is not configured.');
      websiteResearch = await crawlWebsite(websiteUrl);
    }

    const groundedContext = redactObject({
      activeInbox,
      selectedEmail: activeEmail || null,
      recentInbox,
      websiteResearch,
      attachedDocuments: attachments.filter((file: any) => file.text || file.extractionError).map((file: any) => ({
        name: file.name,
        type: file.type,
        text: file.text,
        extractionError: file.extractionError || undefined,
      })),
    });

    const systemPrompt = `You are the Fleet OS communication copilot.
Use the authenticated organization context supplied by the server. Never infer tenant identity from an inbox supplied by the user.
Ground names, facts, deadlines, and claims in the supplied context. Clearly label assumptions and never invent search results.
Use the user's preferred ${personality} tone. Extract action items, owners, dates, blockers, and the safest next action.
Never claim an email, calendar event, browser action, payment, invoice, schedule, dispatch, authorization, prospect conversion, or work-order change executed unless a confirmed executor returned success.
For outbound email, you may prepare a reviewable email draft. Consequential actions remain confirmation-gated.
The visible response must be plain human-readable text without Markdown headings, tables, or fenced code.
Firecrawl is the information-research provider. Browserbase is reserved for explicit browser actions and is never a research fallback.

If an email draft is useful, include exactly one hidden review block:
\`\`\`json:email_draft
{"to":"recipient@example.com","subject":"Subject","body":"Body"}
\`\`\`
If the user requests a supported consequential action, include exactly one hidden action block:
\`\`\`json:agent_action
{"kind":"supported.action.kind","payload":{}}
\`\`\`

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

    const aiResult = await callAICompletion(safeMessages, systemPrompt);

    let emailDraft = null;
    const draftMatch = aiResult.content.match(/```json:email_draft\s*([\s\S]*?)\s*```/);
    if (draftMatch) {
      try { emailDraft = JSON.parse(draftMatch[1]); } catch { emailDraft = null; }
    }

    let actionProposal = null;
    const actionMatch = aiResult.content.match(/```json:agent_action\s*([\s\S]*?)\s*```/);
    if (actionMatch) {
      try {
        const action = JSON.parse(actionMatch[1]);
        actionProposal = createAgentActionProposal(action.kind, action.payload);
      } catch (error) {
        console.warn('Ignored invalid agent action proposal:', error instanceof Error ? error.message : error);
      }
    }

    return res.json({
      content: formatAgentPlainText(aiResult.content),
      model: aiResult.model,
      provider: aiResult.provider,
      emailDraft,
      actionProposal,
      skillsUsed: [...AGENT_SKILLS.filter((skill: any) => typeof skill === 'string').slice(0, 0), 'tenant-grounding', 'context-memory', 'predictive-drafting', 'grounded-recall', ...(websiteResearch ? ['website-crawl'] : []), 'pii-redaction', 'sentinel'],
    });
  } catch (error) {
    console.error('Tenant chat error:', error instanceof Error ? error.message : error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to process chat request' });
  }
});
