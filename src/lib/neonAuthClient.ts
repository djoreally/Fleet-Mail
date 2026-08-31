import { createClient } from '@neondatabase/neon-js';
import { DEFAULT_NEON_DATA_API_URL, DEFAULT_NEON_AUTH_URL } from './neon';
import { User, Email, Inbox, ContactRecord, ChatMessageRecord } from '../db/drizzleSchema';

const TOKEN_STORAGE_KEY = 'neon_auth_token';
const USER_STORAGE_KEY = 'neon_auth_user';

export interface NeonAuthSession {
  token: string | null;
  user: {
    id: string;
    email: string;
    name?: string;
  } | null;
}

/**
 * Retrieves the currently active Neon Auth session from storage
 */
export function getActiveNeonAuthSession(): NeonAuthSession {
  if (typeof window === 'undefined') {
    return { token: null, user: null };
  }
  try {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    const userStr = localStorage.getItem(USER_STORAGE_KEY);
    const user = userStr ? JSON.parse(userStr) : null;
    return { token, user };
  } catch {
    return { token: null, user: null };
  }
}

/**
 * Saves or clears the active Neon Auth session
 */
export function setActiveNeonAuthSession(token: string | null, user: any | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
    if (user) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  } catch (err) {
    console.warn('Failed to persist Neon auth session:', err);
  }
}

/**
 * Helper function to create an authenticated Neon client wrapper.
 * Automatically injects the active Neon Auth JWT bearer token into all Data API calls
 * and handles RLS-compliant CRUD queries.
 */
export function createAuthenticatedNeonClient(customToken?: string) {
  const session = getActiveNeonAuthSession();
  const token = customToken || session.token;

  const dataApiUrl =
    (typeof import.meta !== 'undefined' && (import.meta as any)?.env?.VITE_NEON_DATA_API_URL) ||
    DEFAULT_NEON_DATA_API_URL;
  // This wrapper uses the existing Fleet OS session as an external identity
  // provider. Neon calls getToken for each Data API request, so credentials are
  // never baked into a shared client or exposed through static headers.
  const client = createClient({
    dataApi: {
      url: dataApiUrl,
      getToken: async () => customToken || getActiveNeonAuthSession().token || '',
    },
  });

  /**
   * Universal fetch helper for Data API with automatic authentication header attachment
   */
  async function authFetch<T = any>(
    path: string,
    options: RequestInit = {}
  ): Promise<{ data: T | null; error: string | null; status: number }> {
    try {
      const activeToken = customToken || getActiveNeonAuthSession().token;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(options.headers as Record<string, string>),
      };

      if (activeToken) {
        headers['Authorization'] = `Bearer ${activeToken}`;
      }

      const url = `${dataApiUrl}${path.startsWith('/') ? path : `/${path}`}`;
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const status = response.status;
      if (!response.ok) {
        const errText = await response.text();
        let errMsg = errText;
        try {
          const parsed = JSON.parse(errText);
          errMsg = parsed.message || parsed.error || errText;
        } catch {
          // ignore
        }
        return { data: null, error: errMsg, status };
      }

      const data = (await response.json()) as T;
      return { data, error: null, status };
    } catch (err: any) {
      return {
        data: null,
        error: err.message || 'Network request failed to Neon Data API',
        status: 0,
      };
    }
  }

  return {
    client,
    authFetch,
    getToken: () => customToken || getActiveNeonAuthSession().token,
    getUser: () => getActiveNeonAuthSession().user,

    // =========================================================================
    // Typed Data API Query Handlers
    // =========================================================================

    // Users Operations
    users: {
      async get(userId: string): Promise<{ data: User | null; error: string | null }> {
        const res = await authFetch<User[]>(`/users?id=eq.${userId}&limit=1`);
        return { data: res.data?.[0] || null, error: res.error };
      },
      async getCurrentUser(): Promise<{ data: User | null; error: string | null }> {
        const user = getActiveNeonAuthSession().user;
        if (!user?.id) return { data: null, error: 'No active session' };
        return this.get(user.id);
      },
      async upsert(user: Partial<User>): Promise<{ data: User | null; error: string | null }> {
        const res = await authFetch<User[]>('/users', {
          method: 'POST',
          body: JSON.stringify(user),
          headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        });
        return { data: res.data?.[0] || null, error: res.error };
      },
    },

    // Emails Operations
    emails: {
      async list(options?: { inboxId?: string; limit?: number; offset?: number }): Promise<{
        data: Email[] | null;
        error: string | null;
      }> {
        let query = `/emails?order=created_at.desc&limit=${options?.limit || 50}`;
        if (options?.inboxId) {
          query += `&inbox_id=eq.${options.inboxId}`;
        }
        if (options?.offset) {
          query += `&offset=${options.offset}`;
        }
        const res = await authFetch<Email[]>(query);
        return { data: res.data, error: res.error };
      },
      async getById(emailId: string): Promise<{ data: Email | null; error: string | null }> {
        const res = await authFetch<Email[]>(`/emails?id=eq.${emailId}&limit=1`);
        return { data: res.data?.[0] || null, error: res.error };
      },
      async insert(email: Partial<Email>): Promise<{ data: Email | null; error: string | null }> {
        const res = await authFetch<Email[]>('/emails', {
          method: 'POST',
          body: JSON.stringify(email),
          headers: { Prefer: 'return=representation' },
        });
        return { data: res.data?.[0] || null, error: res.error };
      },
      async update(emailId: string, updates: Partial<Email>): Promise<{ data: Email | null; error: string | null }> {
        const res = await authFetch<Email[]>(`/emails?id=eq.${emailId}`, {
          method: 'PATCH',
          body: JSON.stringify(updates),
          headers: { Prefer: 'return=representation' },
        });
        return { data: res.data?.[0] || null, error: res.error };
      },
      async delete(emailId: string): Promise<{ success: boolean; error: string | null }> {
        const res = await authFetch(`/emails?id=eq.${emailId}`, {
          method: 'DELETE',
        });
        return { success: !res.error, error: res.error };
      },
    },

    // Contacts Operations
    contacts: {
      async list(): Promise<{ data: ContactRecord[] | null; error: string | null }> {
        const res = await authFetch<ContactRecord[]>('/contacts?order=created_at.desc');
        return { data: res.data, error: res.error };
      },
      async insert(contact: Partial<ContactRecord>): Promise<{ data: ContactRecord | null; error: string | null }> {
        const res = await authFetch<ContactRecord[]>('/contacts', {
          method: 'POST',
          body: JSON.stringify(contact),
          headers: { Prefer: 'return=representation' },
        });
        return { data: res.data?.[0] || null, error: res.error };
      },
      async update(id: string, updates: Partial<ContactRecord>): Promise<{ data: ContactRecord | null; error: string | null }> {
        const res = await authFetch<ContactRecord[]>(`/contacts?id=eq.${id}`, {
          method: 'PATCH',
          body: JSON.stringify(updates),
          headers: { Prefer: 'return=representation' },
        });
        return { data: res.data?.[0] || null, error: res.error };
      },
      async delete(id: string): Promise<{ success: boolean; error: string | null }> {
        const res = await authFetch(`/contacts?id=eq.${id}`, {
          method: 'DELETE',
        });
        return { success: !res.error, error: res.error };
      },
    },

    // Inboxes Operations
    inboxes: {
      async list(): Promise<{ data: Inbox[] | null; error: string | null }> {
        const res = await authFetch<Inbox[]>('/inboxes?order=created_at.asc');
        return { data: res.data, error: res.error };
      },
      async insert(inbox: Partial<Inbox>): Promise<{ data: Inbox | null; error: string | null }> {
        const res = await authFetch<Inbox[]>('/inboxes', {
          method: 'POST',
          body: JSON.stringify(inbox),
          headers: { Prefer: 'return=representation' },
        });
        return { data: res.data?.[0] || null, error: res.error };
      },
    },

    // Chat Messages Operations
    chatMessages: {
      async list(limit = 100): Promise<{ data: ChatMessageRecord[] | null; error: string | null }> {
        const res = await authFetch<ChatMessageRecord[]>(`/chat_messages?order=created_at.asc&limit=${limit}`);
        return { data: res.data, error: res.error };
      },
      async insert(msg: Partial<ChatMessageRecord>): Promise<{ data: ChatMessageRecord | null; error: string | null }> {
        const res = await authFetch<ChatMessageRecord[]>('/chat_messages', {
          method: 'POST',
          body: JSON.stringify(msg),
          headers: { Prefer: 'return=representation' },
        });
        return { data: res.data?.[0] || null, error: res.error };
      },
    },
  };
}

// Global default singleton instance
export const authNeonClient = createAuthenticatedNeonClient();
