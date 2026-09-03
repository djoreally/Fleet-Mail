import { getActiveNeonAuthSession } from './neonAuthClient';

let authFetchInstalled = false;

/**
 * Ensures every same-origin Fleet OS API request carries the active Neon Auth
 * bearer token, including older call sites that still use window.fetch directly.
 * External requests are never modified.
 */
export function installFleetApiAuth() {
  if (authFetchInstalled || typeof window === 'undefined') return;
  const originalFetch = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(rawUrl, window.location.origin);
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/')) return originalFetch(input, init);

    const token = getActiveNeonAuthSession().token;
    if (!token) return originalFetch(input, init);

    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    headers.set('authorization', `Bearer ${token}`);
    return originalFetch(input, { ...init, headers });
  };

  authFetchInstalled = true;
}

export function fleetHeaders(extra: HeadersInit = {}): HeadersInit {
  const token = getActiveNeonAuthSession().token;
  return { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...extra };
}

export async function fleetFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  return fetch(input, { ...init, headers: fleetHeaders(init.headers) });
}
