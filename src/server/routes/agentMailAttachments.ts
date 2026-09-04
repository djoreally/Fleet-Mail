import { Router } from 'express';
import { serverConfig } from '../config.js';
import { fleetAuthFailure, requireFleetOrganization } from '../services/fleetAuth.js';

export const agentMailAttachmentsRouter = Router();

function safeInbox(value: unknown) {
  return String(value || '').trim().slice(0, 320);
}

agentMailAttachmentsRouter.get('/agentmail/messages/:messageId/attachments', async (req, res) => {
  try {
    await requireFleetOrganization(req);
    const inbox = safeInbox(req.query.inbox);
    if (!inbox) return res.status(400).json({ error: 'Inbox is required' });
    const apiKey = process.env.AGENTMAIL_API_KEY?.trim();
    if (!apiKey) return res.status(503).json({ error: 'AgentMail is not configured' });

    const base = serverConfig.agentMailBaseUrl.replace(/\/$/, '');
    const messageResponse = await fetch(`${base}/inboxes/${encodeURIComponent(inbox)}/messages/${encodeURIComponent(req.params.messageId)}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    });
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
  } catch (error) {
    return fleetAuthFailure(res, error);
  }
});

agentMailAttachmentsRouter.get('/agentmail/messages/:messageId/attachments/:attachmentId', async (req, res) => {
  try {
    await requireFleetOrganization(req);
    const inbox = safeInbox(req.query.inbox);
    if (!inbox) return res.status(400).json({ error: 'Inbox is required' });
    const apiKey = process.env.AGENTMAIL_API_KEY?.trim();
    if (!apiKey) return res.status(503).json({ error: 'AgentMail is not configured' });

    const base = serverConfig.agentMailBaseUrl.replace(/\/$/, '');
    const response = await fetch(`${base}/inboxes/${encodeURIComponent(inbox)}/messages/${encodeURIComponent(req.params.messageId)}/attachments/${encodeURIComponent(req.params.attachmentId)}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    });
    if (!response.ok) return res.status(response.status).json({ error: 'Attachment could not be retrieved' });
    const item: any = await response.json();
    return res.json({
      attachment: {
        id: String(item?.attachment_id || item?.attachmentId || req.params.attachmentId),
        filename: String(item?.filename || 'attachment').slice(0, 240),
        contentType: String(item?.content_type || item?.contentType || 'application/octet-stream').slice(0, 160),
        size: Number(item?.size || 0) || undefined,
        downloadUrl: String(item?.download_url || item?.downloadUrl || ''),
        expiresAt: item?.expires_at || item?.expiresAt || null,
      },
    });
  } catch (error) {
    return fleetAuthFailure(res, error);
  }
});