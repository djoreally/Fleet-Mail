export interface TableDefinition {
  name: string;
  description: string;
  columns: {
    name: string;
    type: string;
    description: string;
    isPrimary?: boolean;
    isNullable?: boolean;
    defaultValue?: string;
  }[];
  rlsPolicy: string;
}

export const SCHEMA_TABLES: TableDefinition[] = [
  {
    name: 'contacts',
    description: 'Address book contacts and CRM metadata with AI auto-extraction details',
    columns: [
      { name: 'id', type: 'TEXT', isPrimary: true, description: 'Unique contact identifier' },
      { name: 'user_id', type: 'TEXT', isNullable: true, description: 'Owner user ID from Neon Auth' },
      { name: 'name', type: 'TEXT', isNullable: false, description: 'Full contact name' },
      { name: 'email', type: 'TEXT', isNullable: false, description: 'Primary email address' },
      { name: 'company', type: 'TEXT', isNullable: true, description: 'Company or organization' },
      { name: 'role', type: 'TEXT', isNullable: true, description: 'Job title or role' },
      { name: 'phone', type: 'TEXT', isNullable: true, description: 'Phone number' },
      { name: 'avatar_url', type: 'TEXT', isNullable: true, description: 'Avatar picture URL' },
      { name: 'tags', type: 'TEXT[]', defaultValue: "'{}'", description: 'Classification tags (VIP, Team, etc.)' },
      { name: 'notes', type: 'TEXT', isNullable: true, description: 'Relationship context and notes' },
      { name: 'last_contacted', type: 'TIMESTAMPTZ', isNullable: true, description: 'Timestamp of last email/activity' },
      { name: 'is_favorite', type: 'BOOLEAN', defaultValue: 'FALSE', description: 'Starred favorite contact' },
      { name: 'source', type: 'TEXT', defaultValue: "'manual'", description: 'Origin (manual, inbox, agentmail)' },
      { name: 'created_at', type: 'TIMESTAMPTZ', defaultValue: 'NOW()', description: 'Record creation timestamp' }
    ],
    rlsPolicy: 'user_id = auth.uid() OR user_id IS NULL'
  },
  {
    name: 'emails',
    description: 'Synced email inbox messages, sent items, headers, and AI analysis digests',
    columns: [
      { name: 'id', type: 'TEXT', isPrimary: true, description: 'Email message ID' },
      { name: 'user_id', type: 'TEXT', isNullable: true, description: 'Owner user ID' },
      { name: 'inbox_id', type: 'TEXT', isNullable: true, description: 'Target inbox address' },
      { name: 'thread_id', type: 'TEXT', isNullable: true, description: 'Thread identifier' },
      { name: 'from_address', type: 'TEXT', isNullable: false, description: 'Sender email' },
      { name: 'from_name', type: 'TEXT', isNullable: true, description: 'Sender display name' },
      { name: 'avatar_url', type: 'TEXT', isNullable: true, description: 'Sender avatar' },
      { name: 'to_addresses', type: 'TEXT[]', defaultValue: "'{}'", description: 'Recipient email addresses' },
      { name: 'subject', type: 'TEXT', isNullable: false, description: 'Subject line' },
      { name: 'text_content', type: 'TEXT', isNullable: true, description: 'Plain text email body' },
      { name: 'html_content', type: 'TEXT', isNullable: true, description: 'HTML formatted body' },
      { name: 'is_read', type: 'BOOLEAN', defaultValue: 'FALSE', description: 'Read receipt status' },
      { name: 'is_starred', type: 'BOOLEAN', defaultValue: 'FALSE', description: 'Starred important flag' },
      { name: 'action_required', type: 'TEXT', isNullable: true, description: 'AI detected required action' },
      { name: 'labels', type: 'TEXT[]', defaultValue: "'{}'", description: 'Categorization labels' },
      { name: 'summary', type: 'JSONB', isNullable: true, description: 'AI Summary (tldr, urgency, actionItems, replies)' },
      { name: 'created_at', type: 'TIMESTAMPTZ', defaultValue: 'NOW()', description: 'Received / Sent timestamp' }
    ],
    rlsPolicy: 'user_id = auth.uid() OR user_id IS NULL'
  },
  {
    name: 'chat_messages',
    description: 'AI Email Copilot conversation logs, draft artifacts, and calendar invites',
    columns: [
      { name: 'id', type: 'TEXT', isPrimary: true, description: 'Message ID' },
      { name: 'user_id', type: 'TEXT', isNullable: true, description: 'Owner user ID' },
      { name: 'role', type: 'TEXT', isNullable: false, description: 'user, assistant, or system' },
      { name: 'content', type: 'TEXT', isNullable: false, description: 'Message markdown content' },
      { name: 'chips', type: 'TEXT[]', defaultValue: "'{}'", description: 'Suggested follow-up action chips' },
      { name: 'calendar_invite', type: 'JSONB', isNullable: true, description: 'Generated meeting artifact' },
      { name: 'email_draft', type: 'JSONB', isNullable: true, description: 'Generated draft proposal' },
      { name: 'email_summary', type: 'JSONB', isNullable: true, description: 'Generated email summary artifact' },
      { name: 'created_at', type: 'TIMESTAMPTZ', defaultValue: 'NOW()', description: 'Creation timestamp' }
    ],
    rlsPolicy: 'user_id = auth.uid() OR user_id IS NULL'
  },
  {
    name: 'inboxes',
    description: 'Connected and managed email inboxes (AgentMail, Google, Custom)',
    columns: [
      { name: 'id', type: 'TEXT', isPrimary: true, description: 'Inbox ID' },
      { name: 'user_id', type: 'TEXT', isNullable: true, description: 'Owner user ID' },
      { name: 'email', type: 'TEXT', isNullable: false, description: 'Inbox email address' },
      { name: 'name', type: 'TEXT', isNullable: false, description: 'Inbox friendly name' },
      { name: 'provider', type: 'TEXT', defaultValue: "'agentmail'", description: 'Provider type' },
      { name: 'is_active', type: 'BOOLEAN', defaultValue: 'TRUE', description: 'Active sync status' },
      { name: 'created_at', type: 'TIMESTAMPTZ', defaultValue: 'NOW()', description: 'Creation timestamp' }
    ],
    rlsPolicy: 'user_id = auth.uid() OR user_id IS NULL'
  },
  {
    name: 'user_settings',
    description: 'User personalization settings, AI behavior, and connected provider accounts',
    columns: [
      { name: 'user_id', type: 'TEXT', isPrimary: true, description: 'User ID' },
      { name: 'personality_focus', type: 'TEXT', defaultValue: "'Professional'", description: 'AI Tone (Professional, Friendly, Concise)' },
      { name: 'important_emails_only', type: 'BOOLEAN', defaultValue: 'TRUE', description: 'Highlight high-priority emails' },
      { name: 'daily_ai_digest', type: 'BOOLEAN', defaultValue: 'TRUE', description: 'Automated morning summary digest' },
      { name: 'connected_accounts', type: 'JSONB', defaultValue: "'[]'", description: 'OAuth & Provider accounts' },
      { name: 'updated_at', type: 'TIMESTAMPTZ', defaultValue: 'NOW()', description: 'Last update timestamp' }
    ],
    rlsPolicy: 'user_id = auth.uid()'
  }
];

export const RAW_SQL_MIGRATION = `-- ==============================================================================
-- AI Mail x Neon Database Schema Migration
-- Database: PostgreSQL (Neon Serverless & Neon Data API)
-- Auth: Neon Auth / RLS Enforced
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Inboxes Table
CREATE TABLE IF NOT EXISTS inboxes (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id TEXT,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'agentmail',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inboxes_user_id ON inboxes(user_id);
CREATE INDEX IF NOT EXISTS idx_inboxes_email ON inboxes(email);

-- 2. Contacts Table
CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id TEXT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    company TEXT,
    role TEXT,
    phone TEXT,
    avatar_url TEXT,
    tags TEXT[] DEFAULT '{}',
    notes TEXT,
    last_contacted TIMESTAMPTZ,
    is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
    source TEXT NOT NULL DEFAULT 'manual',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_is_favorite ON contacts(is_favorite);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at DESC);

-- 3. Emails Table
CREATE TABLE IF NOT EXISTS emails (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id TEXT,
    inbox_id TEXT,
    thread_id TEXT,
    from_address TEXT NOT NULL,
    from_name TEXT,
    avatar_url TEXT,
    to_addresses TEXT[] NOT NULL DEFAULT '{}',
    subject TEXT NOT NULL DEFAULT '(No Subject)',
    text_content TEXT,
    html_content TEXT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    is_starred BOOLEAN NOT NULL DEFAULT FALSE,
    action_required TEXT,
    labels TEXT[] DEFAULT '{}',
    summary JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_emails_user_id ON emails(user_id);
CREATE INDEX IF NOT EXISTS idx_emails_inbox_id ON emails(inbox_id);
CREATE INDEX IF NOT EXISTS idx_emails_thread_id ON emails(thread_id);
CREATE INDEX IF NOT EXISTS idx_emails_created_at ON emails(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_emails_is_read ON emails(is_read);
CREATE INDEX IF NOT EXISTS idx_emails_is_starred ON emails(is_starred);

-- 4. Chat Messages Table
CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id TEXT,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    chips TEXT[] DEFAULT '{}',
    calendar_invite JSONB,
    email_draft JSONB,
    email_summary JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at ASC);

-- 5. User Settings Table
CREATE TABLE IF NOT EXISTS user_settings (
    user_id TEXT PRIMARY KEY,
    personality_focus TEXT NOT NULL DEFAULT 'Professional',
    important_emails_only BOOLEAN NOT NULL DEFAULT TRUE,
    daily_ai_digest BOOLEAN NOT NULL DEFAULT TRUE,
    connected_accounts JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Row-Level Security (RLS)
ALTER TABLE inboxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own contacts" ON contacts;
CREATE POLICY "Users can manage their own contacts" ON contacts
    FOR ALL
    USING (user_id IS NULL OR user_id = auth.uid()::TEXT)
    WITH CHECK (user_id IS NULL OR user_id = auth.uid()::TEXT);

DROP POLICY IF EXISTS "Users can manage their own emails" ON emails;
CREATE POLICY "Users can manage their own emails" ON emails
    FOR ALL
    USING (user_id IS NULL OR user_id = auth.uid()::TEXT)
    WITH CHECK (user_id IS NULL OR user_id = auth.uid()::TEXT);

DROP POLICY IF EXISTS "Users can manage their own chat messages" ON chat_messages;
CREATE POLICY "Users can manage their own chat messages" ON chat_messages
    FOR ALL
    USING (user_id IS NULL OR user_id = auth.uid()::TEXT)
    WITH CHECK (user_id IS NULL OR user_id = auth.uid()::TEXT);

DROP POLICY IF EXISTS "Users can manage their own inboxes" ON inboxes;
CREATE POLICY "Users can manage their own inboxes" ON inboxes
    FOR ALL
    USING (user_id IS NULL OR user_id = auth.uid()::TEXT)
    WITH CHECK (user_id IS NULL OR user_id = auth.uid()::TEXT);

DROP POLICY IF EXISTS "Users can manage their own settings" ON user_settings;
CREATE POLICY "Users can manage their own settings" ON user_settings
    FOR ALL
    USING (user_id IS NULL OR user_id = auth.uid()::TEXT)
    WITH CHECK (user_id IS NULL OR user_id = auth.uid()::TEXT);
`;
