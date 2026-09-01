import { Router } from 'express';
import { serverConfig } from '../config.js';
import { callAICompletion } from '../services/ai.js';
import { getAgentMailClient } from '../services/agentmail.js';
import { decodeVin, decodeVins, NhtsaError } from '../services/nhtsa.js';
import { AGENT_SKILLS, formatAgentPlainText, redactObject, redactSensitiveData } from '../services/agentSkills.js';
import { createAgentActionProposal } from '../services/agentActions.js';
import { createVehicle, deleteVehicle, importVehicles, listVehicles, updateVehicle, VehicleStoreError } from '../services/vehicleStore.js';
import { FleetAuthError, requireFleetOrganization } from '../services/fleetAuth.js';
import type { StoredContact, StoredEmail } from '../types.js';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../../db/index.js';
import { contacts as contactTable } from '../../db/drizzleSchema.js';
import { crawlWebsite, extractWebsiteUrl } from '../services/firecrawl.js';
import { fetchWithBrowserbase } from '../services/browserbase.js';

export const apiRouter = Router();

const vehicleError = (res: import('express').Response, error: unknown) => {
  const status = error instanceof VehicleStoreError || error instanceof FleetAuthError ? error.status : 500;
  return res.status(status).json({ error: error instanceof Error ? error.message : 'Vehicle operation failed' });
};

apiRouter.get('/vehicles', async (req, res) => {
  try { return res.json(await listVehicles(await requireFleetOrganization(req))); } catch (error) { return vehicleError(res, error); }
});

apiRouter.post('/vehicles', async (req, res) => {
  try { return res.status(201).json({ vehicle: await createVehicle(req.body ?? {}, await requireFleetOrganization(req)) }); } catch (error) { return vehicleError(res, error); }
});

apiRouter.post('/vehicles/import', async (req, res) => {
  try {
    const vehicles = await importVehicles(req.body?.vehicles, await requireFleetOrganization(req));
    return res.status(201).json({ vehicles, count: vehicles.length });
  } catch (error) { return vehicleError(res, error); }
});

apiRouter.put('/vehicles/:id', async (req, res) => {
  try { return res.json({ vehicle: await updateVehicle(req.params.id, req.body ?? {}, await requireFleetOrganization(req)) }); } catch (error) { return vehicleError(res, error); }
});

apiRouter.delete('/vehicles/:id', async (req, res) => {
  try { await deleteVehicle(req.params.id, await requireFleetOrganization(req)); return res.status(204).end(); } catch (error) { return vehicleError(res, error); }
});

const { atlasCloudBaseUrl: ATLASCLOUD_BASE_URL, atlasCloudModel: ATLASCLOUD_MODEL,
  agentMailBaseUrl: AGENTMAIL_BASE_URL, defaultInbox: DEFAULT_INBOX,
  neonDataApiUrl: NEON_DATA_API_URL, neonAuthUrl: NEON_AUTH_URL } = serverConfig;

apiRouter.post('/vehicles/decode-vin', async (req, res) => {
  try {
    const decoded = await decodeVin({ ...(req.body ?? {}), vin: req.body?.vin || req.query.vin, modelYear: req.body?.modelYear || req.query.modelYear });
    return res.json({ decoded });
  } catch (error) {
    const status = error instanceof NhtsaError ? error.status : 500;
    return res.status(status).json({ error: error instanceof Error ? error.message : 'VIN decoding failed' });
  }
});

apiRouter.post('/vehicles/decode-vins', async (req, res) => {
  try {
    const results = await decodeVins(req.body?.vehicles);
    return res.json({ results, count: results.length });
  } catch (error) {
    const status = error instanceof NhtsaError ? error.status : 500;
    return res.status(status).json({ error: error instanceof Error ? error.message : 'VIN batch decoding failed' });
  }
});

// In-memory email cache & storage for thread tracking and caching AI summaries
let simulatedEmails: StoredEmail[] = [];


// 1. Status Check API
apiRouter.get('/status', (req, res) => {
  const atlasKey = process.env.ATLASCLOUD_API_KEY;
  const agentKey = process.env.AGENTMAIL_API_KEY;

  res.json({
    atlasCloudConfigured: Boolean(atlasKey && atlasKey !== 'your-atlascloud-api-key' && atlasKey.trim() !== ''),
    agentMailConfigured: Boolean(agentKey && agentKey !== 'your-agentmail-api-key' && agentKey.trim() !== ''),
    neonConfigured: Boolean(NEON_DATA_API_URL && NEON_AUTH_URL),
    googleConfigured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_TOKEN_ENCRYPTION_KEY),
    firecrawlConfigured: Boolean(process.env.FIRECRAWL_API_KEY?.trim()),
    browserbaseConfigured: Boolean(process.env.BROWSERBASE_API_KEY?.trim()),
    neonDataApiUrl: NEON_DATA_API_URL,
    neonAuthUrl: NEON_AUTH_URL,
    defaultInbox: DEFAULT_INBOX,
    model: ATLASCLOUD_MODEL,
    activeInbox: DEFAULT_INBOX
  });
});

apiRouter.get('/agent/skills', (_req, res) => {
  res.json({ skills: AGENT_SKILLS, model: ATLASCLOUD_MODEL, provider: 'AtlasCloud', confirmationPolicy: 'All external writes require an explicit user action.' });
});

// 2. Chat / Agent Completion API
apiRouter.post('/chat', async (req, res) => {
  try {
    const { messages, contextInbox, activeEmail, personality = 'Professional' } = req.body;
    const rawAttachments = Array.isArray(req.body?.attachments) ? req.body.attachments.slice(0, 4) : [];
    const attachmentBytes = rawAttachments.reduce((sum: number, file: any) => sum + Number(file?.size || 0), 0);
    if (attachmentBytes > 3_000_000) return res.status(413).json({ error: 'Attachments must total 3 MB or less.' });
    const attachments = rawAttachments.map((file: any) => ({
      name: String(file?.name || 'attachment').slice(0, 180),
      type: String(file?.type || 'application/octet-stream').slice(0, 100),
      kind: file?.kind === 'image' ? 'image' : 'document',
      text: typeof file?.text === 'string' ? redactSensitiveData(file.text.slice(0, 20_000)) : '',
      dataUrl: typeof file?.dataUrl === 'string' && /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(file.dataUrl) ? file.dataUrl : '',
    }));

    let recentInbox: any[] = [];
    try {
      const mail = await getAgentMailClient()?.inboxes.messages.list(DEFAULT_INBOX, { limit: 12 });
      recentInbox = (mail?.messages || []).map((item: any) => ({
        from: item.from, to: item.to, subject: item.subject,
        preview: String(item.text || item.preview || item.snippet || '').slice(0, 500),
        createdAt: item.createdAt || item.created_at,
      }));
    } catch (error) {
      console.warn('Agent grounding inbox unavailable:', error instanceof Error ? error.message : error);
    }

    const contactContext = typeof storedContacts === 'undefined' ? [] : storedContacts.slice(0, 40).map((contact) => ({ name: contact.name, email: contact.email, company: contact.company, role: contact.role }));
    const latestUserText = [...(Array.isArray(messages) ? messages : [])].reverse().find((message: any) => message?.role === 'user')?.content || '';
    const websiteUrl = extractWebsiteUrl(String(latestUserText));
    let websiteResearch = null;
    let browserResearch = null;
    if (websiteUrl) {
      if (process.env.BROWSERBASE_API_KEY?.trim()) browserResearch = await fetchWithBrowserbase(websiteUrl);
      else if (process.env.FIRECRAWL_API_KEY?.trim()) websiteResearch = await crawlWebsite(websiteUrl);
      else throw new Error('Website research is not configured.');
    }
    const groundedContext = redactObject({ selectedEmail: activeEmail || null, recentInbox, contacts: contactContext, websiteResearch, browserResearch, attachedDocuments: attachments.filter((file: any) => file.text).map((file: any) => ({ name: file.name, type: file.type, text: file.text })) });

    const systemPrompt = `You are "ChatMail AI" powered by AtlasCloud's dots-studio/dots-3-note-prev-free model.
You are an intelligent, proactive executive email copilot and communication assistant managing inbox "${contextInbox || DEFAULT_INBOX}".

You are the Fleet OS agent. Your enabled skills are thread memory, predictive drafting, sentiment and tone analysis, grounded recall, inbox/contact search, Browserbase browser access, Firecrawl website research, confirmed email execution, confirmed calendar execution, fleet-context reasoning, sensitive-data protection, and Sentinel confirmation.

Rules:
1. Ground names, facts, deadlines, and claims in the supplied context. Clearly label assumptions and never invent search results.
2. Detect urgency, frustration, ambiguity, and relationship risk. Use the user's preferred ${personality} tone.
3. Extract action items, owners, dates, blockers, and the safest next action.
4. Never claim an email was sent, an event was created, or data was changed. You may prepare an action, but the UI executes it only after explicit confirmation.
5. For outbound email, provide a one-click draft block. Never include secrets, SSNs, or payment-card data.
6. For bulk work, prepare reviewable drafts; never auto-send a batch.
7. The visible response must be plain human-readable text. Never use Markdown headings, asterisks, underscores, tables, or fenced code. Use short paragraphs and simple sentences.
8. When websiteResearch or browserResearch is present, answer from that content and include the relevant source URL as a plain link. Do not claim you accessed pages absent from the supplied context.

Structure for 1-click sendable email block (if applicable):
\`\`\`json:email_draft
{
  "to": "recipient@example.com",
  "subject": "Clear Subject Line",
  "body": "Hi Name,\\n\\nEmail body text here...\\n\\nBest regards,\\nSender"
}
\`\`\`

When the user asks to send an email or create a calendar event, also prepare exactly one reviewable action block. Never say it was executed:
\`\`\`json:agent_action
{"kind":"email.send","payload":{"to":"recipient@example.com","subject":"Subject","text":"Body"}}
\`\`\`
or
\`\`\`json:agent_action
{"kind":"calendar.create","payload":{"title":"Event title","start":"ISO-8601 date-time","end":"ISO-8601 date-time","attendees":["person@example.com"],"description":"Optional context"}}
\`\`\`

Current Context:
- Active Inbox: ${contextInbox || DEFAULT_INBOX}
 - Grounded data: ${JSON.stringify(groundedContext)}
${activeEmail ? `- Selected Email Context:
  From: ${activeEmail.from}
  Subject: ${activeEmail.subject}
  Date: ${activeEmail.created_at}
  Content: ${activeEmail.text}
` : ''}

Respond helpfully, clearly, and proactively.`;

    const safeMessages = (Array.isArray(messages) ? messages : []).map((message: any) => ({ ...message, content: redactSensitiveData(String(message.content || '')) }));
    const imageParts = attachments.filter((file: any) => file.dataUrl).map((file: any) => ({ type: 'image_url' as const, image_url: { url: file.dataUrl } }));
    if (imageParts.length && safeMessages.length) {
      const latest = safeMessages.length - 1;
      safeMessages[latest] = { ...safeMessages[latest], content: [{ type: 'text' as const, text: safeMessages[latest].content }, ...imageParts] };
    }
    const aiResult = await callAICompletion(safeMessages, systemPrompt);

    // Check if there's an email draft block in the response
    let emailDraft = null;
    const jsonDraftMatch = aiResult.content.match(/```json:email_draft\s*([\s\S]*?)\s*```/);
    if (jsonDraftMatch) {
      try {
        emailDraft = JSON.parse(jsonDraftMatch[1]);
      } catch (e) {
        console.error('Failed to parse email draft json:', e);
      }
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

    res.json({
      content: formatAgentPlainText(aiResult.content),
      model: aiResult.model,
      provider: aiResult.provider,
      emailDraft
      ,actionProposal
      ,skillsUsed: ['context-memory', 'predictive-drafting', 'emotional-intelligence', 'grounded-recall', ...(browserResearch ? ['browser-access'] : []), ...(websiteResearch ? ['website-crawl'] : []), 'pii-redaction', 'sentinel']
    });
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message || 'Failed to process chat request' });
  }
});

// Tone Rewrite Endpoint (for the AI Assist panel in Compose: "Make it warmer", "More concise", etc.)
apiRouter.post('/rewrite-tone', async (req, res) => {
  try {
    const { body, subject, tone = 'warmer' } = req.body;
    const prompt = `Rewrite the following email draft body with the tone "${tone}". Keep the core message, but make the tone feel natural, polished, and fitting for a modern team communication.

Original Subject: ${subject || '(No subject)'}
Original Body:
${body || '(Empty)'}

Return ONLY the rewritten email body text. Do not include markdown code fences or prefixes.`;

    const aiResult = await callAICompletion(
      [{ role: 'user', content: prompt }],
      'You are a high-speed communication tone specialist.'
    );

    res.json({
      rewrittenBody: aiResult.content.trim(),
      tone,
      model: aiResult.model
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to rewrite tone' });
  }
});

// Draft from Prompt Endpoint (for AI Assist panel in Compose)
apiRouter.post('/generate-draft', async (req, res) => {
  try {
    const { promptText, tone = 'Professional', recipient = '', contextSubject = '' } = req.body;
    const prompt = `Generate a complete, high-quality email draft based on this instruction: "${promptText}".
Target Tone: ${tone}
Recipient context: ${recipient || 'Team / Client'}
Subject context: ${contextSubject || 'None'}

Return your response in EXACT JSON format with these exact keys:
{
  "subject": "Clear, compelling subject line",
  "body": "Hi [Name],\\n\\n[Draft content]\\n\\nBest,\\n[Sender]"
}
Return ONLY valid JSON.`;

    const aiResult = await callAICompletion(
      [{ role: 'user', content: prompt }],
      'You are an executive email drafting specialist. Output valid JSON only.'
    );

    let cleanJson = aiResult.content.trim();
    if (cleanJson.startsWith('```json')) {
      cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    let parsed;
    try {
      parsed = JSON.parse(cleanJson);
    } catch {
      parsed = {
        subject: contextSubject || 'Follow-up regarding project updates',
        body: aiResult.content
      };
    }

    res.json(parsed);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to generate draft' });
  }
});

// 3. Summarize Email Endpoint using AtlasCloud Dots-3
apiRouter.post('/summarize-email', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email object is required' });
    }

    const prompt = `Analyze and summarize the following email with high precision:
FROM: ${email.from}
TO: ${Array.isArray(email.to) ? email.to.join(', ') : email.to}
SUBJECT: ${email.subject}
DATE: ${email.created_at}
BODY:
${email.text || email.html || '(No body text)'}

Provide a comprehensive, high-utility summary in EXACT JSON format with these exact keys:
{
  "tldr": "1-2 sentence executive summary of what this email is about and what is required",
  "actionItems": ["Action item 1", "Action item 2"],
  "urgency": "Low" | "Medium" | "High" | "Critical",
  "sentiment": "Positive" | "Neutral" | "Urgent" | "Informative",
  "keyPoints": ["Key point 1", "Key point 2"],
  "suggestedReplies": ["Brief positive acknowledgment", "Clarification reply option", "Polite reschedule/alternative"]
}
Return ONLY valid JSON. No surrounding markdown formatting.`;

    const aiResult = await callAICompletion(
      [{ role: 'user', content: prompt }],
      'You are a high-speed executive email analyst. Output valid JSON only.'
    );

    let cleanJson = aiResult.content.trim();
    if (cleanJson.startsWith('```json')) {
      cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    let parsedSummary;
    try {
      parsedSummary = JSON.parse(cleanJson);
    } catch (e) {
      parsedSummary = {
        tldr: aiResult.content.slice(0, 200),
        actionItems: ['Review email message details'],
        urgency: 'Medium',
        sentiment: 'Informative',
        keyPoints: ['Email received at ' + email.created_at],
        suggestedReplies: ['Thank you for the update.', 'I have received your email and will review.']
      };
    }

    parsedSummary.generatedAt = new Date().toISOString();
    parsedSummary.modelUsed = aiResult.model;

    // Cache summary to in-memory email if present
    const existing = simulatedEmails.find(e => e.id === email.id);
    if (existing) {
      existing.summary = parsedSummary;
    }

    res.json({ summary: parsedSummary });
  } catch (error: any) {
    console.error('Summarize error:', error);
    res.status(500).json({ error: error.message || 'Failed to summarize email' });
  }
});

// 4. AgentMail Threads / Messages Proxy
apiRouter.get('/agentmail/threads', async (req, res) => {
  const inbox = (req.query.inbox as string) || DEFAULT_INBOX;
  const limit = Number(req.query.limit) || 10;
  const agentKey = process.env.AGENTMAIL_API_KEY;
  const client = getAgentMailClient();

  if (client && agentKey && agentKey !== 'your-agentmail-api-key' && agentKey.trim() !== '') {
    try {
      const data = await client.inboxes.threads.list(inbox, { limit });
      return res.json(data);
    } catch (e: any) {
      console.warn('AgentMail threads SDK error, trying direct REST call:', e.message);
      try {
        const response = await fetch(`${AGENTMAIL_BASE_URL}/inboxes/${encodeURIComponent(inbox)}/threads?limit=${limit}`, {
          headers: {
            'Authorization': `Bearer ${agentKey.trim()}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          return res.json(data);
        }
        console.warn('AgentMail threads REST call returned:', response.status);
      } catch (restErr: any) {
        console.warn('AgentMail fetch error, falling back to local store:', restErr.message);
      }
    }
  }

  // Fallback to local simulated emails for the inbox
  const filtered = simulatedEmails.filter(e => e.inbox_id.toLowerCase() === inbox.toLowerCase());
  res.json({
    threads: filtered.map(email => ({
      id: email.thread_id || email.id,
      inbox_id: email.inbox_id,
      subject: email.subject,
      snippet: email.text.slice(0, 120),
      last_message_at: email.created_at,
      message_count: 1,
      messages: [email]
    }))
  });
});

apiRouter.get('/agentmail/messages', async (req, res) => {
  const inbox = (req.query.inbox as string) || DEFAULT_INBOX;
  const limit = Number(req.query.limit) || 30;
  const agentKey = process.env.AGENTMAIL_API_KEY;
  const client = getAgentMailClient();

  let liveMessages: StoredEmail[] = [];
  let fetchedFromLive = false;

  if (client && agentKey && agentKey !== 'your-agentmail-api-key' && agentKey.trim() !== '') {
    try {
      // 1. Try SDK list
      const data = await client.inboxes.messages.list(inbox, { limit });
      const rawList = data?.messages || [];

      liveMessages = rawList.map((m: any) => {
        const sender = m.from || 'Unknown Sender';
        const fromName = sender.includes('<') ? sender.split('<')[0].replace(/"/g, '').trim() : sender.split('@')[0];
        const cached = simulatedEmails.find(se => se.id === (m.messageId || m.id));

        return {
          id: m.messageId || m.id,
          thread_id: m.threadId || m.thread_id || `th_${m.messageId || m.id}`,
          inbox_id: m.inboxId || m.inbox_id || inbox,
          from: sender,
          fromName: fromName || 'Sender',
          avatarUrl: cached?.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fromName || sender)}`,
          to: m.to || [inbox],
          subject: m.subject || '(No Subject)',
          text: m.text || m.preview || m.body || m.snippet || '',
          html: m.html || undefined,
          created_at: m.createdAt || m.timestamp || m.created_at || new Date().toISOString(),
          read: m.labels ? !m.labels.includes('unread') : (m.read !== undefined ? m.read : true),
          starred: m.labels ? m.labels.includes('starred') : (m.starred || false),
          summary: cached?.summary || m.summary
        };
      });

      fetchedFromLive = true;
    } catch (sdkErr: any) {
      console.warn('AgentMail messages SDK error, trying direct REST call:', sdkErr.message);
      try {
        const response = await fetch(`${AGENTMAIL_BASE_URL}/inboxes/${encodeURIComponent(inbox)}/messages?limit=${limit}`, {
          headers: {
            'Authorization': `Bearer ${agentKey.trim()}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          const rawList = Array.isArray(data) ? data : (data.messages || []);
          
          liveMessages = rawList.map((m: any) => {
            const sender = m.from || 'Unknown Sender';
            const fromName = sender.includes('<') ? sender.split('<')[0].replace(/"/g, '').trim() : sender.split('@')[0];
            const cached = simulatedEmails.find(se => se.id === (m.messageId || m.id));

            return {
              id: m.messageId || m.id,
              thread_id: m.threadId || m.thread_id || `th_${m.messageId || m.id}`,
              inbox_id: m.inboxId || m.inbox_id || inbox,
              from: sender,
              fromName: fromName || 'Sender',
              avatarUrl: cached?.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fromName || sender)}`,
              to: m.to || [inbox],
              subject: m.subject || '(No Subject)',
              text: m.text || m.preview || m.body || m.snippet || '',
              html: m.html || undefined,
              created_at: m.createdAt || m.timestamp || m.created_at || new Date().toISOString(),
              read: m.labels ? !m.labels.includes('unread') : (m.read !== undefined ? m.read : true),
              starred: m.labels ? m.labels.includes('starred') : (m.starred || false),
              summary: cached?.summary || m.summary
            };
          });

          fetchedFromLive = true;
        } else {
          console.warn('AgentMail messages REST call returned status:', response.status);
        }
      } catch (restErr: any) {
        console.warn('AgentMail fetch error, falling back to local store:', restErr.message);
      }
    }
  }

  // Merge with any freshly sent or incoming cached items
  const localItems = simulatedEmails.filter(e => 
    e.inbox_id.toLowerCase() === inbox.toLowerCase() ||
    (Array.isArray(e.to) ? e.to.some(t => t.toLowerCase().includes(inbox.toLowerCase())) : String(e.to).toLowerCase().includes(inbox.toLowerCase()))
  );

  const merged = [...liveMessages];
  for (const item of localItems) {
    if (!merged.some(m => m.id === item.id)) {
      merged.push(item);
    }
  }

  // Sort by created_at descending
  merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  res.json({
    messages: merged,
    liveConnection: fetchedFromLive,
    inbox
  });
});

// 5. Send Email Proxy via AgentMail
apiRouter.post('/agentmail/send', async (req, res) => {
  try {
    const { inbox = DEFAULT_INBOX, to, subject, body, html, replyToMessageId } = req.body;
    if (!to || !subject || !body) {
      return res.status(400).json({ error: 'Missing required fields: to, subject, body' });
    }

    const agentKey = process.env.AGENTMAIL_API_KEY;
    const client = getAgentMailClient();

    // Format recipients cleanly (e.g. "Jane <jane@example.com>" -> "jane@example.com" or preserve email)
    const rawToList = Array.isArray(to) ? to : [to];
    const cleanToList = rawToList.map((addr: string) => {
      const trimmed = String(addr).trim();
      const match = trimmed.match(/<([^>]+)>/);
      return match ? match[1].trim() : trimmed;
    }).filter(Boolean);

    let liveSendSuccess = false;
    let externalResponse: any = null;
    let errorMessage: string | null = null;

    if (agentKey && agentKey !== 'your-agentmail-api-key' && agentKey.trim() !== '') {
      // 1. Try sending via AgentMail SDK
      if (client) {
        try {
          if (replyToMessageId) {
            console.log(`[AgentMail] Replying to message ${replyToMessageId} in inbox ${inbox}...`);
            const replyRes = await client.inboxes.messages.reply(inbox, replyToMessageId, {
              text: body,
              html: html || `<p>${body.replace(/\n/g, '<br/>')}</p>`
            });
            externalResponse = replyRes;
            liveSendSuccess = true;
          } else {
            console.log(`[AgentMail] Sending message from inbox ${inbox} to:`, cleanToList);
            const sendRes = await client.inboxes.messages.send(inbox, {
              to: cleanToList,
              subject,
              text: body,
              html: html || `<p>${body.replace(/\n/g, '<br/>')}</p>`
            });
            externalResponse = sendRes;
            liveSendSuccess = true;
          }
        } catch (sdkError: any) {
          console.warn(`[AgentMail SDK send failed on inbox '${inbox}']:`, sdkError.message);
          errorMessage = sdkError.message;

          // If inbox ID format mismatch (e.g. inbox username 'moms' vs 'moms@agentmail.to'), retry with stripped username
          const inboxUsername = inbox.includes('@') ? inbox.split('@')[0] : inbox;
          if (inboxUsername !== inbox) {
            try {
              console.log(`[AgentMail] Retrying SDK send with inbox username '${inboxUsername}'...`);
              const retryRes = await client.inboxes.messages.send(inboxUsername, {
                to: cleanToList,
                subject,
                text: body,
                html: html || `<p>${body.replace(/\n/g, '<br/>')}</p>`
              });
              externalResponse = retryRes;
              liveSendSuccess = true;
              errorMessage = null;
            } catch (retryErr: any) {
              console.warn(`[AgentMail SDK send retry failed on '${inboxUsername}']:`, retryErr.message);
            }
          }
        }
      }

      // 2. If SDK was not successful, fallback to direct REST POST to /v0/inboxes/{inbox}/messages/send
      if (!liveSendSuccess) {
        try {
          console.log(`[AgentMail] Attempting direct REST POST to /v0/inboxes/${encodeURIComponent(inbox)}/messages/send...`);
          const restRes = await fetch(`${AGENTMAIL_BASE_URL}/inboxes/${encodeURIComponent(inbox)}/messages/send`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${agentKey.trim()}`
            },
            body: JSON.stringify({
              to: cleanToList,
              subject,
              text: body,
              html: html || `<p>${body.replace(/\n/g, '<br/>')}</p>`
            })
          });

          if (restRes.ok) {
            externalResponse = await restRes.json();
            liveSendSuccess = true;
            errorMessage = null;
          } else {
            const errText = await restRes.text();
            console.error(`[AgentMail REST /messages/send returned ${restRes.status}]:`, errText);
            errorMessage = `AgentMail API returned ${restRes.status}: ${errText}`;
          }
        } catch (restError: any) {
          console.error('[AgentMail direct REST send error]:', restError.message);
          errorMessage = restError.message;
        }
      }
    }

    const assignedMessageId = externalResponse?.messageId || externalResponse?.id || `msg_sent_${Date.now()}`;
    const assignedThreadId = externalResponse?.threadId || externalResponse?.thread_id || `th_sent_${Date.now()}`;

    // Record the sent email in local list so it appears in the Sent folder and state
    const newSentMessage: StoredEmail = {
      id: assignedMessageId,
      thread_id: assignedThreadId,
      inbox_id: inbox,
      from: inbox,
      fromName: 'Me',
      to: cleanToList,
      subject,
      text: body,
      html: html || `<p>${body.replace(/\n/g, '<br/>')}</p>`,
      created_at: new Date().toISOString(),
      formattedTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      relativeTime: 'Just now',
      read: true,
      starred: false,
      labels: ['sent']
    };

    simulatedEmails.unshift(newSentMessage);

    res.json({
      success: true,
      message: liveSendSuccess ? 'Email sent successfully via AgentMail' : 'Email dispatched locally',
      liveApiUsed: liveSendSuccess,
      messageId: assignedMessageId,
      threadId: assignedThreadId,
      errorDetails: errorMessage,
      data: externalResponse || newSentMessage
    });
  } catch (error: any) {
    console.error('Send email error:', error);
    res.status(500).json({ error: error.message || 'Failed to send email' });
  }
});

// 6. Simulate / Trigger Incoming Email to moms@agentmail.to (for real-time testing and inbox watcher demonstration)
apiRouter.post('/agentmail/simulate-incoming', async (req, res) => {
  try {
    const { from, subject, text, inbox = DEFAULT_INBOX } = req.body;

    if (!from || !subject || !text) {
      return res.status(400).json({ error: 'from, subject, and text are required' });
    }

    const newIncoming: StoredEmail = {
      id: `msg_in_${Date.now()}`,
      thread_id: `th_in_${Date.now()}`,
      inbox_id: inbox,
      from,
      to: inbox,
      subject,
      text,
      created_at: new Date().toISOString(),
      read: false,
      starred: true,
    };

    simulatedEmails.unshift(newIncoming);

    res.json({
      success: true,
      message: 'Incoming email simulated successfully for inbox watcher',
      email: newIncoming
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Contacts API & Address Book Endpoints
let storedContacts: StoredContact[] = [];
const contactRepository = () => {
  const database=getDb(); if(!database) throw new Error('DATABASE_URL is required');
  return {
    list:(organizationId:string,_page?:unknown)=>database.select().from(contactTable).where(eq(contactTable.organizationId,organizationId)),
    getById:async(organizationId:string,id:string)=>(await database.select().from(contactTable).where(and(eq(contactTable.organizationId,organizationId),eq(contactTable.id,id))).limit(1))[0]||null,
    upsert:async(organizationId:string,value:any)=>{const fields={name:String(value.name||value.email),email:value.email?String(value.email).toLowerCase():null,phone:value.phone||null,role:value.role||null,notes:value.notes||null,tags:Array.isArray(value.tags)?value.tags:[],isPrimary:Boolean(value.isPrimary||value.isFavorite)};if(value.id){return (await database.update(contactTable).set({...fields,updatedAt:new Date()}).where(and(eq(contactTable.organizationId,organizationId),eq(contactTable.id,value.id))).returning())[0];}const existing=value.email?(await database.select().from(contactTable).where(and(eq(contactTable.organizationId,organizationId),eq(contactTable.email,String(value.email).toLowerCase()))).limit(1))[0]:null;if(existing)return (await database.update(contactTable).set({...fields,updatedAt:new Date()}).where(eq(contactTable.id,existing.id)).returning())[0];return (await database.insert(contactTable).values({id:randomUUID(),organizationId,...fields}).returning())[0];},
    delete:async(organizationId:string,id:string)=>(await database.delete(contactTable).where(and(eq(contactTable.organizationId,organizationId),eq(contactTable.id,id))).returning()).length>0,
  };
};
const presentContact = (contact:any):StoredContact => ({ id:contact.id,name:contact.name,email:contact.email,company:contact.company||undefined,role:contact.role||undefined,phone:contact.phone||undefined,notes:contact.notes||undefined,tags:contact.tags||[],isFavorite:Boolean(contact.isFavorite),source:contact.source||'manual',lastContacted:contact.updatedAt ? new Date(contact.updatedAt).toISOString() : undefined });

// GET /api/contacts - List contacts
apiRouter.get('/contacts', async (req, res) => {
  try { const organizationId=await requireFleetOrganization(req); const query=String(req.query.q||'').toLowerCase().trim(); const all=(await contactRepository().list(organizationId,{limit:500})).map(presentContact); const contacts=query?all.filter(c=>`${c.name} ${c.email} ${c.company||''} ${(c.tags||[]).join(' ')}`.toLowerCase().includes(query)):all; return res.json({contacts,total:contacts.length}); } catch(error) { return vehicleError(res,error); }
});

// POST /api/contacts - Create contact
apiRouter.post('/contacts', async (req, res) => {
  const { name, email, company, role, phone, tags, notes, isFavorite } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const cleanEmail = email.trim().toLowerCase();
  try { const organizationId=await requireFleetOrganization(req); const saved=await contactRepository().upsert(organizationId,{name:name?.trim()||cleanEmail.split('@')[0],email:cleanEmail,company:company?.trim()||null,role:role?.trim()||null,phone:phone?.trim()||null,notes:notes?.trim()||null,tags:Array.isArray(tags)?tags:(tags?[tags]:['General']),isFavorite:Boolean(isFavorite),source:'manual'}); return res.status(201).json({success:true,contact:presentContact(saved)}); } catch(error) { return vehicleError(res,error); }
});

// PUT /api/contacts/:id - Update contact
apiRouter.put('/contacts/:id', async (req, res) => {
  try { const organizationId=await requireFleetOrganization(req); const current=await contactRepository().getById(organizationId,req.params.id); if(!current)return res.status(404).json({error:'Contact not found'}); const saved=await contactRepository().upsert(organizationId,{...current,...req.body,id:current.id}); return res.json({success:true,contact:presentContact(saved)}); } catch(error) { return vehicleError(res,error); }
});

// DELETE /api/contacts/:id - Delete contact
apiRouter.delete('/contacts/:id', async (req, res) => {
  try { const organizationId=await requireFleetOrganization(req); const deleted=await contactRepository().delete(organizationId,req.params.id); if(!deleted)return res.status(404).json({error:'Contact not found'}); return res.json({success:true,deletedId:req.params.id}); } catch(error) { return vehicleError(res,error); }
});

// POST /api/contacts/extract-from-inbox - Automatically discover contacts from messages
apiRouter.post('/contacts/extract-from-inbox', (req, res) => {
  const added: StoredContact[] = [];

  for (const email of simulatedEmails) {
    const rawFrom = email.from;
    const emailMatch = rawFrom.match(/<([^>]+)>/);
    const address = (emailMatch ? emailMatch[1] : rawFrom).trim().toLowerCase();
    const displayName = email.fromName || (rawFrom.includes('<') ? rawFrom.split('<')[0].replace(/"/g, '').trim() : address.split('@')[0]);

    if (!address || address.includes('no-reply') || address.includes('notification')) {
      continue;
    }

    const alreadyExists = storedContacts.some(c => c.email.toLowerCase() === address);
    if (!alreadyExists) {
      const newContact: StoredContact = {
        id: `cnt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        name: displayName,
        email: address,
        avatarUrl: email.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}`,
        tags: ['Inbox Contact'],
        lastContacted: email.created_at || new Date().toISOString(),
        source: 'inbox',
        isFavorite: false
      };
      storedContacts.unshift(newContact);
      added.push(newContact);
    }
  }

  res.json({
    success: true,
    addedCount: added.length,
    addedContacts: added,
    totalContacts: storedContacts.length
  });
});

// Neon Data API & Auth Management Endpoints
apiRouter.get('/neon/health', async (req, res) => {
  try {
    const dataApiEndpoint = NEON_DATA_API_URL;
    const authEndpoint = NEON_AUTH_URL;

    // Check Data API Reachability
    let dataApiOk = false;
    let dataApiStatusCode = 0;
    try {
      const resp = await fetch(`${dataApiEndpoint}/`, {
        method: 'GET',
        headers: { Accept: 'application/json' }
      });
      dataApiStatusCode = resp.status;
      dataApiOk = resp.status < 500;
    } catch (e: any) {
      dataApiStatusCode = 503;
    }

    // Check Auth Endpoint Reachability
    let authOk = false;
    let authStatusCode = 0;
    try {
      const resp = await fetch(`${authEndpoint}/health` || `${authEndpoint}/`, {
        method: 'GET'
      });
      authStatusCode = resp.status;
      authOk = resp.status < 500;
    } catch (e: any) {
      authStatusCode = 503;
    }

    res.json({
      status: 'ok',
      configured: true,
      dataApi: {
        url: dataApiEndpoint,
        connected: dataApiOk,
        statusCode: dataApiStatusCode
      },
      auth: {
        url: authEndpoint,
        connected: authOk,
        statusCode: authStatusCode
      },
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({
      status: 'error',
      error: err.message || 'Failed to test Neon connectivity'
    });
  }
});

// Proxy/query tables via Data API from backend
apiRouter.post('/neon/query', async (req, res) => {
  try {
    const { table, select = '*', limit = 50, filter } = req.body;
    if (!table) {
      return res.status(400).json({ error: 'Table name is required' });
    }

    let url = `${NEON_DATA_API_URL}/${encodeURIComponent(table)}?select=${encodeURIComponent(select)}&limit=${limit}`;
    if (filter) {
      url += `&${filter}`;
    }

    const authHeader = req.headers.authorization;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    };
    if (authHeader) {
      headers.Authorization = authHeader;
    }

    const resp = await fetch(url, {
      method: 'GET',
      headers
    });

    const data = await resp.json();
    res.status(resp.status).json({ data, status: resp.status });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Query failed' });
  }
});

// Neon Schema Migration & Table Verification Endpoints
apiRouter.get('/neon/schema', async (req, res) => {
  try {
    const tableNames = ['contacts', 'emails', 'chat_messages', 'user_settings', 'inboxes'];
    const tableStatuses: Record<string, { exists: boolean; status: string; rowCount?: number }> = {};

    for (const table of tableNames) {
      try {
        const resp = await fetch(`${NEON_DATA_API_URL}/${table}?limit=1`, {
          method: 'GET',
          headers: { Accept: 'application/json' }
        });
        if (resp.status === 200) {
          tableStatuses[table] = { exists: true, status: 'Active & Accessible via Data API' };
        } else if (resp.status === 404 || resp.status === 400) {
          tableStatuses[table] = { exists: false, status: 'Not yet created in PostgreSQL' };
        } else {
          tableStatuses[table] = { exists: false, status: `HTTP ${resp.status}` };
        }
      } catch (err: any) {
        tableStatuses[table] = { exists: false, status: 'Endpoint unreachable' };
      }
    }

    res.json({
      status: 'ok',
      tables: tableStatuses,
      dataApiUrl: NEON_DATA_API_URL,
      authUrl: NEON_AUTH_URL,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to inspect schema' });
  }
});

// Run Schema Migration (Drizzle ORM & Neon Serverless DDL)
apiRouter.post('/neon/migrate', async (req, res) => {
  try {
    const { runDrizzleMigration } = await import('../../db/migrate.js').catch(() => import('../../db/migrate'));
    const report = await runDrizzleMigration();
    return res.json(report);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      logs: [`[${new Date().toLocaleTimeString()}] ❌ Migration failed: ${err.message || err}`],
      error: err.message || 'Migration encountered an error',
    });
  }
});

apiRouter.post('/drizzle/migrate', async (req, res) => {
  try {
    const { runDrizzleMigration } = await import('../../db/migrate.js').catch(() => import('../../db/migrate'));
    const report = await runDrizzleMigration();
    return res.json(report);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Drizzle migration failed',
    });
  }
});
