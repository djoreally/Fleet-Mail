import { Router } from 'express';
import { serverConfig } from '../config.js';
import { fleetAuthFailure, requireFleetOrganization } from '../services/fleetAuth.js';

export const agentMailAttachmentsRouter = Router();
const MAX_INLINE_BYTES = 3_000_000;
const MAX_ATTACHMENTS = 4;

function safeInbox(value: unknown) {
  return String(value || '').trim().slice(0, 320);
}
function safeText(value: unknown, max: number) {
  return String(value || '').trim().slice(0, max);
}

agentMailAttachmentsRouter.get('/agentmail/messages/:messageId/attachments', async (req, res) => {
  try {
    await requireFleetOrganization(req);
    const inbox = safeInbox(req.query.inbox);
    if (!inbox) return res.status(400).json({ error: 'Inbox is required' });
    const apiKey = process.env.AGENTMAIL_API_KEY?.trim();
    if (!apiKey) return res.status(503).json({ error: 'AgentMail is not configured' });
    const base = serverConfig.agentMailBaseUrl.replace(/\/$/, '');
    const messageResponse = await fetch(`${base}/inboxes/${encodeURIComponent(inbox)}/messages/${encodeURIComponent(req.params.messageId)}`, { headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' } });
    if (!messageResponse.ok) return res.status(messageResponse.status).json({ error: 'Message attachments could not be loaded' });
    const message: any = await messageResponse.json();
    const raw = Array.isArray(message?.attachments) ? message.attachments : [];
    const attachments = raw.map((item: any) => ({
      id: String(item?.attachment_id || item?.attachmentId || item?.id || ''),
      filename: String(item?.filename || item?.name || 'attachment').slice(0, 240),
      contentType: String(item?.content_type || item?.contentType || 'application/octet-stream').slice(0, 160),
      size: Number(item?.size || 0) || undefined,
      disposition: String(item?.content_disposition || item?.contentDisposition || 'attachment').slice(0, 40),
    })).filter((item: any) => item.id);
    return res.json({ attachments });
  } catch (error) { return fleetAuthFailure(res, error); }
});

agentMailAttachmentsRouter.get('/agentmail/messages/:messageId/attachments/:attachmentId', async (req, res) => {
  try {
    await requireFleetOrganization(req);
    const inbox = safeInbox(req.query.inbox);
    if (!inbox) return res.status(400).json({ error: 'Inbox is required' });
    const apiKey = process.env.AGENTMAIL_API_KEY?.trim();
    if (!apiKey) return res.status(503).json({ error: 'AgentMail is not configured' });
    const base = serverConfig.agentMailBaseUrl.replace(/\/$/, '');
    const response = await fetch(`${base}/inboxes/${encodeURIComponent(inbox)}/messages/${encodeURIComponent(req.params.messageId)}/attachments/${encodeURIComponent(req.params.attachmentId)}`, { headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' } });
    if (!response.ok) return res.status(response.status).json({ error: 'Attachment could not be retrieved' });
    const item: any = await response.json();
    return res.json({ attachment: {
      id: String(item?.attachment_id || item?.attachmentId || req.params.attachmentId), filename: String(item?.filename || 'attachment').slice(0, 240),
      contentType: String(item?.content_type || item?.contentType || 'application/octet-stream').slice(0, 160), size: Number(item?.size || 0) || undefined,
      downloadUrl: String(item?.download_url || item?.downloadUrl || ''), expiresAt: item?.expires_at || item?.expiresAt || null,
    }});
  } catch (error) { return fleetAuthFailure(res, error); }
});

agentMailAttachmentsRouter.post('/agentmail/send-with-attachments', async (req, res) => {
  try {
    await requireFleetOrganization(req);
    const inbox = safeInbox(req.body?.inbox);
    const to = safeText(req.body?.to, 320);
    const subject = safeText(req.body?.subject, 998);
    const text = safeText(req.body?.body ?? req.body?.text, 100_000);
    const replyToMessageId = safeText(req.body?.replyToMessageId, 200);
    if (!inbox || !to || !subject || !text) return res.status(400).json({ error: 'Inbox, recipient, subject, and body are required' });
    const raw = Array.isArray(req.body?.attachments) ? req.body.attachments.slice(0, MAX_ATTACHMENTS + 1) : [];
    if (raw.length > MAX_ATTACHMENTS) return res.status(413).json({ error: `A maximum of ${MAX_ATTACHMENTS} attachments is allowed` });
    let decodedBytes = 0;
    const attachments = raw.map((item: any) => {
      const content = String(item?.content || '').replace(/^data:[^;]+;base64,/, '');
      if (!/^[A-Za-z0-9+/=]*$/.test(content)) throw new Error('Attachment content must be base64 encoded');
      decodedBytes += Math.floor(content.length * 0.75);
      return { content, filename: safeText(item?.filename || item?.name || 'attachment', 240), content_type: safeText(item?.contentType || item?.content_type || 'application/octet-stream', 160) };
    });
    if (decodedBytes > MAX_INLINE_BYTES) return res.status(413).json({ error: 'Attachments must total 3 MB or less' });
    const apiKey = process.env.AGENTMAIL_API_KEY?.trim();
    if (!apiKey) return res.status(503).json({ error: 'AgentMail is not configured' });
    const base = serverConfig.agentMailBaseUrl.replace(/\/$/, '');
    const endpoint = replyToMessageId
      ? `${base}/inboxes/${encodeURIComponent(inbox)}/messages/${encodeURIComponent(replyToMessageId)}/reply`
      : `${base}/inboxes/${encodeURIComponent(inbox)}/messages/send`;
    const payload = replyToMessageId ? { text, attachments } : { to: [to], subject, text, attachments };
    const response = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) });
    const result: any = await response.json().catch(() => ({}));
    if (!response.ok) return res.status(response.status).json({ error: result?.message || result?.error || 'AgentMail rejected the message' });
    return res.status(200).json({ sent: true, result });
  } catch (error) {
    if (error instanceof Error && /attachment|required|base64/i.test(error.message)) return res.status(400).json({ error: error.message });
    return fleetAuthFailure(res, error);
  }
});
