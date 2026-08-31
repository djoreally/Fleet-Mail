import { Router } from 'express';
import {
  authorizationUrl, createOAuthState, decryptTokens, encryptTokens, exchangeCode,
  googleConfigured, googleFetch, googleRedirectUri, googleUserInfo, parseCookies, verifyOAuthState,
  type GoogleTokens,
} from '../services/googleOAuth.js';

export const googleRouter = Router();
const TOKEN_COOKIE = 'fleet_google_connection';
const STATE_COOKIE = 'fleet_google_oauth_state';
const cookieOptions = 'Path=/; HttpOnly; Secure; SameSite=Lax';

function origin(req: any) {
  return `${req.headers['x-forwarded-proto'] || req.protocol || 'https'}://${req.headers['x-forwarded-host'] || req.headers.host}`;
}

function readTokens(req: any): GoogleTokens | null {
  const value = parseCookies(req.headers.cookie)[TOKEN_COOKIE];
  if (!value) return null;
  try { return decryptTokens(value); } catch { return null; }
}

function writeTokens(res: any, tokens: GoogleTokens) {
  res.append('Set-Cookie', `${TOKEN_COOKIE}=${encodeURIComponent(encryptTokens(tokens))}; ${cookieOptions}; Max-Age=2592000`);
}

googleRouter.get('/status', async (req, res) => {
  if (!googleConfigured()) return res.json({ configured: false, connected: false });
  const tokens = readTokens(req);
  if (!tokens) return res.json({ configured: true, connected: false });
  try {
    const result = await googleUserInfo(tokens);
    writeTokens(res, result.tokens);
    return res.json({ configured: true, connected: true, account: result.data, services: ['gmail', 'calendar'] });
  } catch (error) {
    return res.status(401).json({ configured: true, connected: false, error: error instanceof Error ? error.message : 'Google connection expired' });
  }
});

googleRouter.get('/oauth/start', (req, res) => {
  if (!googleConfigured()) return res.status(503).json({ error: 'Google OAuth is not configured' });
  const state = createOAuthState();
  res.append('Set-Cookie', `${STATE_COOKIE}=${encodeURIComponent(state)}; ${cookieOptions}; Max-Age=600`);
  return res.redirect(authorizationUrl(state, googleRedirectUri(origin(req))));
});

googleRouter.get('/oauth/callback', async (req, res) => {
  const state = String(req.query.state || '');
  const expected = parseCookies(req.headers.cookie)[STATE_COOKIE];
  if (!state || state !== expected || !verifyOAuthState(state)) return res.redirect('/app?google=state_error');
  if (req.query.error) return res.redirect(`/app?google=${encodeURIComponent(String(req.query.error))}`);
  try {
    const tokens = await exchangeCode(String(req.query.code || ''), googleRedirectUri(origin(req)));
    writeTokens(res, tokens);
    res.append('Set-Cookie', `${STATE_COOKIE}=; ${cookieOptions}; Max-Age=0`);
    return res.redirect('/app?view=settings&google=connected');
  } catch (error) {
    console.error('Google OAuth callback failed:', error);
    return res.redirect('/app?google=callback_error');
  }
});

googleRouter.post('/disconnect', (_req, res) => {
  res.append('Set-Cookie', `${TOKEN_COOKIE}=; ${cookieOptions}; Max-Age=0`);
  return res.json({ disconnected: true });
});

googleRouter.get('/gmail/messages', async (req, res) => {
  const tokens = readTokens(req);
  if (!tokens) return res.status(401).json({ error: 'Connect Google first' });
  try {
    const maxResults = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const result = await googleFetch<any>(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`, tokens);
    writeTokens(res, result.tokens);
    return res.json(result.data);
  } catch (error) { return res.status(502).json({ error: error instanceof Error ? error.message : 'Gmail request failed' }); }
});

googleRouter.get('/calendar/events', async (req, res) => {
  const tokens = readTokens(req);
  if (!tokens) return res.status(401).json({ error: 'Connect Google first' });
  try {
    const params = new URLSearchParams({ singleEvents: 'true', orderBy: 'startTime', timeMin: String(req.query.timeMin || new Date().toISOString()), maxResults: String(Math.min(Number(req.query.limit) || 50, 100)) });
    const result = await googleFetch<any>(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, tokens);
    writeTokens(res, result.tokens);
    return res.json(result.data);
  } catch (error) { return res.status(502).json({ error: error instanceof Error ? error.message : 'Calendar request failed' }); }
});

googleRouter.post('/calendar/events', async (req, res) => {
  if (req.headers['x-confirm-action'] !== 'true') return res.status(409).json({ error: 'Calendar writes require x-confirm-action: true' });
  const tokens = readTokens(req);
  if (!tokens) return res.status(401).json({ error: 'Connect Google first' });
  try {
    const result = await googleFetch<any>('https://www.googleapis.com/calendar/v3/calendars/primary/events', tokens, { method: 'POST', body: JSON.stringify(req.body) });
    writeTokens(res, result.tokens);
    return res.status(201).json(result.data);
  } catch (error) { return res.status(502).json({ error: error instanceof Error ? error.message : 'Calendar event creation failed' }); }
});
