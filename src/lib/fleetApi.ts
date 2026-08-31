import { getActiveNeonAuthSession } from './neonAuthClient';

export function fleetHeaders(extra: HeadersInit = {}): HeadersInit {
  const token = getActiveNeonAuthSession().token;
  return { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...extra };
}

export async function fleetFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  return fetch(input, { ...init, headers: fleetHeaders(init.headers) });
}
