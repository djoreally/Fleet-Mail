export interface StoredEmail {
  id: string;
  thread_id?: string;
  inbox_id: string;
  from: string;
  fromName?: string;
  avatarUrl?: string;
  to: string[] | string;
  subject: string;
  text: string;
  html?: string;
  created_at: string;
  formattedTime?: string;
  relativeTime?: string;
  read: boolean;
  starred: boolean;
  actionRequired?: string;
  labels?: string[];
  summary?: unknown;
}

export interface StoredContact {
  id: string;
  name: string;
  email: string;
  company?: string;
  role?: string;
  phone?: string;
  avatarUrl?: string;
  tags?: string[];
  notes?: string;
  lastContacted?: string;
  isFavorite?: boolean;
  source?: 'manual' | 'agentmail' | 'inbox' | 'google';
}
