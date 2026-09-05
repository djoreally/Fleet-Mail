import { getActiveNeonAuthSession } from './neonAuthClient';

let authFetchInstalled = false;
const INVITE_KEY = 'fleetos:pending-invitation';
const WORKSPACE_MODE_KEY = 'fleetos:workspace-mode';

export type FleetWorkspaceMode = 'auto' | 'dispatcher' | 'technician';
type PendingInvite = { id: string; token: string; email?: string };

export function captureFleetInvitationFromLocation(): PendingInvite | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const id = params.get('invite_id')?.trim() || '';
  const token = params.get('invite_token')?.trim() || '';
  const email = params.get('email')?.trim() || undefined;
  if (!id || !token) return getPendingFleetInvitation();
  const value = { id, token, email };
  try { localStorage.setItem(INVITE_KEY, JSON.stringify(value)); } catch {}
  return value;
}

export function getPendingFleetInvitation(): PendingInvite | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(INVITE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw);
    return value?.id && value?.token ? value : null;
  } catch { return null; }
}

export function clearPendingFleetInvitation() {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(INVITE_KEY); } catch {}
}

export function getFleetWorkspaceMode(): FleetWorkspaceMode {
  if (typeof window === 'undefined') return 'auto';
  try {
    const value = localStorage.getItem(WORKSPACE_MODE_KEY);
    return value === 'dispatcher' || value === 'technician' ? value : 'auto';
  } catch { return 'auto'; }
}

export function setFleetWorkspaceMode(mode: FleetWorkspaceMode) {
  if (typeof window === 'undefined') return;
  try {
    if (mode === 'auto') localStorage.removeItem(WORKSPACE_MODE_KEY);
    else localStorage.setItem(WORKSPACE_MODE_KEY, mode);
  } catch {}
}

function invitationHeaders() {
  const invite = getPendingFleetInvitation();
  return invite ? { 'x-fleet-invite-id': invite.id, 'x-fleet-invite-token': invite.token } : {};
}
function workspaceHeaders() {
  const mode = getFleetWorkspaceMode();
  return mode === 'auto' ? {} : { 'x-fleet-workspace-mode': mode };
}

/** Ensures same-origin Fleet OS API requests carry the active Neon Auth bearer token and selected workspace mode. */
export function installFleetApiAuth() {
  if (authFetchInstalled || typeof window === 'undefined') return;
  captureFleetInvitationFromLocation();
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(rawUrl, window.location.origin);
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/')) return originalFetch(input, init);
    const token = getActiveNeonAuthSession().token;
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    if (token) headers.set('authorization', `Bearer ${token}`);
    Object.entries(invitationHeaders()).forEach(([key, value]) => headers.set(key, value));
    Object.entries(workspaceHeaders()).forEach(([key, value]) => headers.set(key, value));
    return originalFetch(input, { ...init, headers });
  };
  authFetchInstalled = true;
}

export function fleetHeaders(extra: HeadersInit = {}): HeadersInit {
  const token = getActiveNeonAuthSession().token;
  return { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...invitationHeaders(), ...workspaceHeaders(), ...extra };
}

export async function fleetFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  return fetch(input, { ...init, headers: fleetHeaders(init.headers) });
}
