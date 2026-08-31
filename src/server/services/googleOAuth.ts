import crypto from 'node:crypto';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar.events',
];

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  scope?: string;
  token_type?: string;
}

function secretKey() {
  const secret = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!secret || secret.length < 24) throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY must be at least 24 characters');
  return crypto.createHash('sha256').update(secret).digest();
}

export function googleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_TOKEN_ENCRYPTION_KEY);
}

export function googleRedirectUri(origin?: string) {
  return process.env.GOOGLE_OAUTH_REDIRECT_URI || `${origin}/api/google/oauth/callback`;
}

export function createOAuthState() {
  const nonce = crypto.randomBytes(24).toString('base64url');
  const signature = crypto.createHmac('sha256', secretKey()).update(nonce).digest('base64url');
  return `${nonce}.${signature}`;
}

export function verifyOAuthState(state: string) {
  const [nonce, signature] = state.split('.');
  if (!nonce || !signature) return false;
  const expected = crypto.createHmac('sha256', secretKey()).update(nonce).digest();
  const actual = Buffer.from(signature, 'base64url');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export function authorizationUrl(state: string, redirectUri: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params}`;
}

export async function exchangeCode(code: string, redirectUri: string): Promise<GoogleTokens> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const body = await response.json() as any;
  if (!response.ok) throw new Error(body.error_description || body.error || 'Google token exchange failed');
  return { ...body, expires_at: Date.now() + Number(body.expires_in || 3600) * 1000 };
}

export async function refreshGoogleTokens(tokens: GoogleTokens): Promise<GoogleTokens> {
  if (tokens.expires_at > Date.now() + 60_000) return tokens;
  if (!tokens.refresh_token) throw new Error('Google refresh token is missing; reconnect the account');
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: tokens.refresh_token,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  });
  const body = await response.json() as any;
  if (!response.ok) throw new Error(body.error_description || body.error || 'Google token refresh failed');
  return { ...tokens, ...body, refresh_token: tokens.refresh_token, expires_at: Date.now() + Number(body.expires_in || 3600) * 1000 };
}

export function encryptTokens(tokens: GoogleTokens) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', secretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(tokens), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.');
}

export function decryptTokens(value: string): GoogleTokens {
  const [iv, tag, encrypted] = value.split('.').map((part) => Buffer.from(part, 'base64url'));
  if (!iv || !tag || !encrypted) throw new Error('Invalid Google connection cookie');
  const decipher = crypto.createDecipheriv('aes-256-gcm', secretKey(), iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8'));
}

export function parseCookies(header?: string) {
  return Object.fromEntries((header || '').split(';').filter(Boolean).map((entry) => {
    const index = entry.indexOf('=');
    return [decodeURIComponent(entry.slice(0, index).trim()), decodeURIComponent(entry.slice(index + 1).trim())];
  }));
}

export async function googleFetch<T>(url: string, tokens: GoogleTokens, init?: RequestInit): Promise<{ data: T; tokens: GoogleTokens }> {
  const current = await refreshGoogleTokens(tokens);
  const response = await fetch(url, { ...init, headers: { ...init?.headers, authorization: `Bearer ${current.access_token}`, 'content-type': 'application/json' } });
  const data = await response.json() as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(data.error?.message || `Google API request failed (${response.status})`);
  return { data, tokens: current };
}

export const googleUserInfo = (tokens: GoogleTokens) => googleFetch<{ email: string; name?: string; picture?: string }>(GOOGLE_USERINFO_URL, tokens);
