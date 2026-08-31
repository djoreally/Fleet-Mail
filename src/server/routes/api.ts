import { Router } from 'express';
import { serverConfig } from '../config.js';
import { callAICompletion } from '../services/ai.js';
import { getAgentMailClient } from '../services/agentmail.js';
import { decodeVin, decodeVins, NhtsaError } from '../services/nhtsa.js';
import type { StoredContact, StoredEmail } from '../types.js';

export const apiRouter = Router();

const { atlasCloudBaseUrl: ATLASCLOUD_BASE_URL, atlasCloudModel: ATLASCLOUD_MODEL,
  agentMailBaseUrl: AGENTMAIL_BASE_URL, defaultInbox: DEFAULT_INBOX,
  neonDataApiUrl: NEON_DATA_API_URL, neonAuthUrl: NEON_AUTH_URL } = serverConfig;

apiRouter.post('/vehicles/decode-vin', async (req, res) => {
  try {
    const decoded = await decodeVin(req.body ?? {});
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
let simulatedEmails: StoredEmail[] = [
  {
    id: 'msg_sarah_q3',
    thread_id: 'th_001',
    inbox_id: DEFAULT_INBOX,
    from: 'sarah.j@company.com',
    fromName: 'Sarah Jenkins',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    to: [DEFAULT_INBOX, 'david.chen@company.com', 'design-team@company.com'],
    subject: 'Q3 Strategy Alignment Meeting',
    text: `Hi team,\n\nThanks for sending over the deck. The presentation looks solid overall, and the narrative flow is much better than our last iteration.\n\nHowever, we need to refine the OKRs for the engineering team before Thursday's review. Specifically, Key Result 2 (latency reduction) seems too ambiguous. Let's make sure we have concrete metrics tied to it.\n\nCan we get these updated by tomorrow EOD?\n\nBest,\nSarah`,
    created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    formattedTime: '10:42 AM',
    relativeTime: '2 hours ago',
    read: false,
    starred: true,
    actionRequired: 'Refine OKRs by Thursday.',
    summary: {
      tldr: 'Sarah approved the presentation but requested specific updates to the engineering OKRs prior to Thursday\'s review meeting.',
      actionItems: ['Refine OKRs for the engineering team before Thursday review', 'Add concrete metrics to Key Result 2 (latency reduction) by tomorrow EOD'],
      urgency: 'High',
      sentiment: 'Informative',
      keyPoints: ['Presentation narrative flow looks solid', 'Key Result 2 needs concrete latency metrics', 'Deadline: Tomorrow EOD for engineering OKRs update'],
      suggestedReplies: ['Draft update OKRs', 'Schedule sync with Eng', 'Confirm review timeline'],
      generatedAt: new Date().toISOString(),
      modelUsed: 'AtlasCloud Dots-3 (Active Intelligence)'
    }
  },
  {
    id: 'msg_design_guild',
    thread_id: 'th_002',
    inbox_id: DEFAULT_INBOX,
    from: 'design-guild@company.com',
    fromName: 'Design System Guild',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    to: ['All Product & Engineering', DEFAULT_INBOX],
    subject: "New tokens published for 'Cognitive Clarity'",
    text: `We've updated the Figma library with the new neutral palette. Please sync your files when you start your next sprint.\n\nKey changes include updated token mappings for background-subtle, text-primary, and elevated elevation tokens.\n\nLet us know in #design-system if you have any questions!`,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    formattedTime: 'Yesterday',
    relativeTime: 'Yesterday',
    read: true,
    starred: false,
    summary: {
      tldr: "The Design System Guild published updated 'Cognitive Clarity' tokens to Figma; teams should sync their local component libraries.",
      actionItems: ['Sync Figma component files at the start of next sprint'],
      urgency: 'Low',
      sentiment: 'Informative',
      keyPoints: ['Updated neutral palette & elevation tokens', 'Support available in #design-system'],
      suggestedReplies: ['Acknowledge & sync', 'Request token migration guide'],
      generatedAt: new Date().toISOString(),
      modelUsed: 'AtlasCloud Dots-3 (Active Intelligence)'
    }
  },
  {
    id: 'msg_security_alerts',
    thread_id: 'th_003',
    inbox_id: DEFAULT_INBOX,
    from: 'no-reply@security.company.com',
    fromName: 'Security Alerts',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    to: [DEFAULT_INBOX],
    subject: 'New sign-in from Chrome on Mac',
    text: `We noticed a new login to your account. If this was you, no action is needed.\n\nDevice: Chrome on macOS\nLocation: San Francisco, CA\nIP: 192.0.2.42\nTime: Today, 8:15 AM\n\nIf you did not authorize this login, please reset your password immediately and secure your account.`,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    formattedTime: 'Mon',
    relativeTime: '3 days ago',
    read: true,
    starred: false,
    summary: {
      tldr: 'Standard security alert confirming a recognized sign-in on Chrome on Mac from San Francisco.',
      actionItems: ['No action required if recognized; change password if suspicious'],
      urgency: 'Low',
      sentiment: 'Neutral',
      keyPoints: ['Device: Chrome on macOS', 'Location: San Francisco, CA'],
      suggestedReplies: ['Mark as recognized', 'Review active sessions'],
      generatedAt: new Date().toISOString(),
      modelUsed: 'AtlasCloud Dots-3 (Active Intelligence)'
    }
  }
];


// 1. Status Check API
apiRouter.get('/status', (req, res) => {
  const atlasKey = process.env.ATLASCLOUD_API_KEY;
  const agentKey = process.env.AGENTMAIL_API_KEY;

  res.json({
    atlasCloudConfigured: Boolean(atlasKey && atlasKey !== 'your-atlascloud-api-key' && atlasKey.trim() !== ''),
    agentMailConfigured: Boolean(agentKey && agentKey !== 'your-agentmail-api-key' && agentKey.trim() !== ''),
    neonConfigured: Boolean(NEON_DATA_API_URL && NEON_AUTH_URL),
    neonDataApiUrl: NEON_DATA_API_URL,
    neonAuthUrl: NEON_AUTH_URL,
    defaultInbox: DEFAULT_INBOX,
    model: ATLASCLOUD_MODEL,
    activeInbox: DEFAULT_INBOX
  });
});

// 2. Chat / Agent Completion API
apiRouter.post('/chat', async (req, res) => {
  try {
    const { messages, contextInbox, activeEmail } = req.body;

    const systemPrompt = `You are "ChatMail AI" powered by AtlasCloud's dots-studio/dots-3-note-prev-free model.
You are an intelligent, proactive executive email copilot and communication assistant managing inbox "${contextInbox || DEFAULT_INBOX}".

Your capabilities:
1. Help the user draft professional, concise, and persuasive emails.
2. Edit, refine, or translate email drafts to various tones (e.g., Professional, Warm, Urgent, Executive, Assertive).
3. Summarize complex email threads and extract clear action items, blockers, and timelines.
4. When drafting an email for the user to send, ALWAYS format the email clearly and include a structured JSON block at the end if an email is ready to send so the user can 1-click send it!

Structure for 1-click sendable email block (if applicable):
\`\`\`json:email_draft
{
  "to": "recipient@example.com",
  "subject": "Clear Subject Line",
  "body": "Hi Name,\\n\\nEmail body text here...\\n\\nBest regards,\\nSender"
}
\`\`\`

Current Context:
- Active Inbox: ${contextInbox || DEFAULT_INBOX}
${activeEmail ? `- Selected Email Context:
  From: ${activeEmail.from}
  Subject: ${activeEmail.subject}
  Date: ${activeEmail.created_at}
  Content: ${activeEmail.text}
` : ''}

Respond helpfully, clearly, and proactively.`;

    const aiResult = await callAICompletion(messages, systemPrompt);

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

    res.json({
      content: aiResult.content,
      model: aiResult.model,
      provider: aiResult.provider,
      emailDraft
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

    const newIncoming: StoredEmail = {
      id: `msg_in_${Date.now()}`,
      thread_id: `th_in_${Date.now()}`,
      inbox_id: inbox,
      from: from || 'alex.chen@innovatecorp.io',
      to: inbox,
      subject: subject || 'Urgent: Feedback on Dots-3 Note API Implementation & Roadmap',
      text: text || 'Hey,\n\nJust tested the new AtlasCloud dots-3-note-prev-free integration. The latency is under 400ms and response quality on email thread distillation is solid.\n\nCould we schedule a quick 15-min sync tomorrow morning to review the live deployment and verify moms@agentmail.to polling triggers?\n\nLet me know what time works best.\n\nCheers,\nAlex Chen',
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
let storedContacts: StoredContact[] = [
  {
    id: 'cnt_sarah',
    name: 'Sarah Jenkins',
    email: 'sarah.j@company.com',
    company: 'Enterprise Products Corp',
    role: 'VP of Product Strategy',
    phone: '+1 (555) 349-8821',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    tags: ['VIP', 'Team', 'Executive'],
    notes: 'Primary point of contact for Q3 strategy alignment and executive reviews.',
    lastContacted: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    isFavorite: true,
    source: 'inbox'
  },
  {
    id: 'cnt_alex_chen',
    name: 'Alex Chen',
    email: 'alex.chen@innovatecorp.io',
    company: 'InnovateCorp Systems',
    role: 'Lead AI Engineer',
    phone: '+1 (555) 782-9910',
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    tags: ['VIP', 'AI/ML', 'Partners'],
    notes: 'Working on AtlasCloud Dots-3 and AgentMail integration pipelines.',
    lastContacted: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    isFavorite: true,
    source: 'agentmail'
  },
  {
    id: 'cnt_david_chen',
    name: 'David Chen',
    email: 'david.chen@company.com',
    company: 'Enterprise Products Corp',
    role: 'Staff Infrastructure Architect',
    phone: '+1 (555) 612-4491',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    tags: ['Team', 'Engineering'],
    notes: 'Coordinates backend performance benchmarks and deployment pipelines.',
    lastContacted: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
    isFavorite: false,
    source: 'inbox'
  },
  {
    id: 'cnt_maya_lin',
    name: 'Maya Lin',
    email: 'maya.lin@designguild.org',
    company: 'Design System Guild',
    role: 'Principal Design Lead',
    phone: '+1 (555) 234-8901',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    tags: ['Design', 'Team'],
    notes: 'Author of Cognitive Clarity design tokens and UI architecture.',
    lastContacted: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    isFavorite: false,
    source: 'inbox'
  },
  {
    id: 'cnt_marcus_vance',
    name: 'Marcus Vance',
    email: 'marcus@vanceresearch.ai',
    company: 'Vance Research Lab',
    role: 'Founding Partner',
    phone: '+1 (555) 902-1133',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    tags: ['Investor', 'VIP'],
    notes: 'Quarterly investor updates and strategic growth advisory.',
    lastContacted: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    isFavorite: true,
    source: 'manual'
  }
];

// GET /api/contacts - List contacts
apiRouter.get('/contacts', (req, res) => {
  const query = (req.query.q as string || '').toLowerCase().trim();
  let result = [...storedContacts];

  if (query) {
    result = result.filter(c =>
      c.name.toLowerCase().includes(query) ||
      c.email.toLowerCase().includes(query) ||
      (c.company && c.company.toLowerCase().includes(query)) ||
      (c.tags && c.tags.some(t => t.toLowerCase().includes(query)))
    );
  }

  res.json({
    contacts: result,
    total: result.length
  });
});

// POST /api/contacts - Create contact
apiRouter.post('/contacts', (req, res) => {
  const { name, email, company, role, phone, tags, notes, isFavorite } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const existingIndex = storedContacts.findIndex(c => c.email.toLowerCase() === cleanEmail);

  const newContact: StoredContact = {
    id: `cnt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    name: name?.trim() || cleanEmail.split('@')[0],
    email: cleanEmail,
    company: company?.trim() || undefined,
    role: role?.trim() || undefined,
    phone: phone?.trim() || undefined,
    avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || cleanEmail)}`,
    tags: Array.isArray(tags) ? tags : (tags ? [tags] : ['General']),
    notes: notes?.trim() || undefined,
    isFavorite: Boolean(isFavorite),
    lastContacted: new Date().toISOString(),
    source: 'manual'
  };

  if (existingIndex >= 0) {
    // Update existing
    storedContacts[existingIndex] = {
      ...storedContacts[existingIndex],
      ...newContact,
      id: storedContacts[existingIndex].id
    };
    return res.json({ success: true, contact: storedContacts[existingIndex], updated: true });
  }

  storedContacts.unshift(newContact);
  res.status(201).json({ success: true, contact: newContact });
});

// PUT /api/contacts/:id - Update contact
apiRouter.put('/contacts/:id', (req, res) => {
  const { id } = req.params;
  const index = storedContacts.findIndex(c => c.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Contact not found' });
  }

  storedContacts[index] = {
    ...storedContacts[index],
    ...req.body,
    id: storedContacts[index].id
  };

  res.json({ success: true, contact: storedContacts[index] });
});

// DELETE /api/contacts/:id - Delete contact
apiRouter.delete('/contacts/:id', (req, res) => {
  const { id } = req.params;
  const initialLength = storedContacts.length;
  storedContacts = storedContacts.filter(c => c.id !== id);

  if (storedContacts.length === initialLength) {
    return res.status(404).json({ error: 'Contact not found' });
  }

  res.json({ success: true, deletedId: id });
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
