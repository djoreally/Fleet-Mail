import { createClient } from '@neondatabase/neon-js';
import { Contact, EmailMessage } from '../types';

export const DEFAULT_NEON_DATA_API_URL =
  'https://ep-sparkling-pine-afqf3sia.apirest.c-2.us-west-2.aws.neon.tech/neondb/rest/v1';
export const DEFAULT_NEON_AUTH_URL =
  'https://ep-sparkling-pine-afqf3sia.neonauth.c-2.us-west-2.aws.neon.tech/neondb/auth';

const dataApiUrl =
  (typeof import.meta !== 'undefined' && (import.meta as any)?.env?.VITE_NEON_DATA_API_URL) ||
  DEFAULT_NEON_DATA_API_URL;

const authUrl =
  (typeof import.meta !== 'undefined' && (import.meta as any)?.env?.VITE_NEON_AUTH_URL) ||
  DEFAULT_NEON_AUTH_URL;

// Initialize Neon Client with unified Auth and Data API
export const neon = createClient({
  auth: {
    url: authUrl,
    allowAnonymous: true,
  },
  dataApi: {
    url: dataApiUrl,
  },
});

export interface NeonConfigStatus {
  dataApiUrl: string;
  authUrl: string;
  isConfigured: boolean;
  connected: boolean;
  error?: string;
  activeSession?: any;
}

// Test Neon Data API and Auth connection
export async function checkNeonHealth(): Promise<NeonConfigStatus> {
  try {
    const res = await fetch(`${dataApiUrl}/`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    const isConnected = res.status < 500;
    return {
      dataApiUrl,
      authUrl,
      isConfigured: Boolean(dataApiUrl && authUrl),
      connected: isConnected,
    };
  } catch (err: any) {
    return {
      dataApiUrl,
      authUrl,
      isConfigured: true,
      connected: false,
      error: err.message || 'Failed to reach Neon Data API endpoint',
    };
  }
}

// Data API Query helpers with graceful fallback
export const neonDb = {
  // 1. Fetch Contacts from Neon Data API
  async getContacts(): Promise<{ data: Contact[] | null; error: any }> {
    try {
      const { data, error } = await neon.from('contacts').select();
      if (error) throw error;
      return { data: data as Contact[], error: null };
    } catch (e: any) {
      return { data: null, error: e.message || e };
    }
  },

  // 2. Insert Contact to Neon Data API
  async addContact(contact: Partial<Contact>): Promise<{ data: any; error: any }> {
    try {
      const { data, error } = await neon.from('contacts').insert(contact).select();
      if (error) throw error;
      return { data, error: null };
    } catch (e: any) {
      return { data: null, error: e.message || e };
    }
  },

  // 3. Update Contact in Neon Data API
  async updateContact(id: string, contact: Partial<Contact>): Promise<{ data: any; error: any }> {
    try {
      const { data, error } = await neon.from('contacts').update(contact).eq('id', id).select();
      if (error) throw error;
      return { data, error: null };
    } catch (e: any) {
      return { data: null, error: e.message || e };
    }
  },

  // 4. Delete Contact in Neon Data API
  async deleteContact(id: string): Promise<{ success: boolean; error: any }> {
    try {
      const { error } = await neon.from('contacts').delete().eq('id', id);
      if (error) throw error;
      return { success: true, error: null };
    } catch (e: any) {
      return { success: false, error: e.message || e };
    }
  },

  // 5. Fetch Emails from Neon Data API
  async getEmails(inbox?: string): Promise<{ data: EmailMessage[] | null; error: any }> {
    try {
      let query = neon.from('emails').select().order('created_at', { ascending: false });
      if (inbox) {
        query = query.eq('inbox_id', inbox);
      }
      const { data, error } = await query;
      if (error) throw error;
      return { data: data as EmailMessage[], error: null };
    } catch (e: any) {
      return { data: null, error: e.message || e };
    }
  },

  // 6. Generic Table Query for testing / exploration
  async queryTable(tableName: string, limit = 20): Promise<{ data: any; error: any }> {
    try {
      const { data, error } = await neon.from(tableName).select().limit(limit);
      if (error) throw error;
      return { data, error: null };
    } catch (e: any) {
      return { data: null, error: e.message || e };
    }
  }
};

export {
  createAuthenticatedNeonClient,
  authNeonClient,
  getActiveNeonAuthSession,
  setActiveNeonAuthSession,
  type NeonAuthSession
} from './neonAuthClient';
