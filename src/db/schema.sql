-- ==============================================================================
-- AI Mail x Neon Database Schema Migration
-- Database: PostgreSQL (Neon Serverless & Neon Data API)
-- Auth: Neon Auth / RLS Enforced
-- ==============================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. Inboxes Table
-- ==============================================================================
CREATE TABLE IF NOT EXISTS inboxes (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id TEXT,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'agentmail', -- 'agentmail', 'google', 'outlook', 'custom'
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_inboxes_user_id ON inboxes(user_id);
CREATE INDEX IF NOT EXISTS idx_inboxes_email ON inboxes(email);

-- ==============================================================================
-- 2. Contacts Table (Address Book & CRM)
-- ==============================================================================
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
    source TEXT NOT NULL DEFAULT 'manual', -- 'manual', 'agentmail', 'inbox', 'google'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast searching and filtering
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_is_favorite ON contacts(is_favorite);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at DESC);

-- ==============================================================================
-- 3. Emails Table (Synced Inbox & Sent Messages)
-- ==============================================================================
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
    summary JSONB, -- AI Email Summary { tldr, actionItems, urgency, sentiment, suggestedReplies }
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for inbox queries
CREATE INDEX IF NOT EXISTS idx_emails_user_id ON emails(user_id);
CREATE INDEX IF NOT EXISTS idx_emails_inbox_id ON emails(inbox_id);
CREATE INDEX IF NOT EXISTS idx_emails_thread_id ON emails(thread_id);
CREATE INDEX IF NOT EXISTS idx_emails_created_at ON emails(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_emails_is_read ON emails(is_read);
CREATE INDEX IF NOT EXISTS idx_emails_is_starred ON emails(is_starred);

-- ==============================================================================
-- 4. Chat Messages Table (AI Copilot Conversations & Artifacts)
-- ==============================================================================
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

-- ==============================================================================
-- 5. User Settings Table
-- ==============================================================================
CREATE TABLE IF NOT EXISTS user_settings (
    user_id TEXT PRIMARY KEY,
    personality_focus TEXT NOT NULL DEFAULT 'Professional',
    important_emails_only BOOLEAN NOT NULL DEFAULT TRUE,
    daily_ai_digest BOOLEAN NOT NULL DEFAULT TRUE,
    connected_accounts JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 6. Row-Level Security (RLS) Policies (Neon Auth & JWT Enforced)
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE inboxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Neon Auth / Postgres JWT Helper Policy for Contacts
DROP POLICY IF EXISTS "Users can manage their own contacts" ON contacts;
CREATE POLICY "Users can manage their own contacts" ON contacts
    FOR ALL
    USING (
        user_id IS NULL OR 
        user_id = current_setting('request.jwt.claims', true)::json->>'sub' OR
        user_id = auth.uid()::TEXT
    )
    WITH CHECK (
        user_id IS NULL OR 
        user_id = current_setting('request.jwt.claims', true)::json->>'sub' OR
        user_id = auth.uid()::TEXT
    );

-- Neon Auth Policy for Emails
DROP POLICY IF EXISTS "Users can manage their own emails" ON emails;
CREATE POLICY "Users can manage their own emails" ON emails
    FOR ALL
    USING (
        user_id IS NULL OR 
        user_id = current_setting('request.jwt.claims', true)::json->>'sub' OR
        user_id = auth.uid()::TEXT
    )
    WITH CHECK (
        user_id IS NULL OR 
        user_id = current_setting('request.jwt.claims', true)::json->>'sub' OR
        user_id = auth.uid()::TEXT
    );

-- Neon Auth Policy for Chat Messages
DROP POLICY IF EXISTS "Users can manage their own chat messages" ON chat_messages;
CREATE POLICY "Users can manage their own chat messages" ON chat_messages
    FOR ALL
    USING (
        user_id IS NULL OR 
        user_id = current_setting('request.jwt.claims', true)::json->>'sub' OR
        user_id = auth.uid()::TEXT
    )
    WITH CHECK (
        user_id IS NULL OR 
        user_id = current_setting('request.jwt.claims', true)::json->>'sub' OR
        user_id = auth.uid()::TEXT
    );

-- Neon Auth Policy for User Settings
DROP POLICY IF EXISTS "Users can manage their own settings" ON user_settings;
CREATE POLICY "Users can manage their own settings" ON user_settings
    FOR ALL
    USING (
        user_id IS NULL OR 
        user_id = current_setting('request.jwt.claims', true)::json->>'sub' OR
        user_id = auth.uid()::TEXT
    )
    WITH CHECK (
        user_id IS NULL OR 
        user_id = current_setting('request.jwt.claims', true)::json->>'sub' OR
        user_id = auth.uid()::TEXT
    );

-- Neon Auth Policy for Inboxes
DROP POLICY IF EXISTS "Users can manage their own inboxes" ON inboxes;
CREATE POLICY "Users can manage their own inboxes" ON inboxes
    FOR ALL
    USING (
        user_id IS NULL OR 
        user_id = current_setting('request.jwt.claims', true)::json->>'sub' OR
        user_id = auth.uid()::TEXT
    )
    WITH CHECK (
        user_id IS NULL OR 
        user_id = current_setting('request.jwt.claims', true)::json->>'sub' OR
        user_id = auth.uid()::TEXT
    );

-- ==============================================================================
-- 7. Seed Initial Demo Inbox & Contacts Data (Optional / Idempotent)
-- ==============================================================================
INSERT INTO inboxes (id, email, name, provider, is_active)
VALUES 
    ('inbox_default', 'moms@agentmail.to', 'Primary AI Inbox', 'agentmail', TRUE),
    ('inbox_team', 'ai-team@agentmail.to', 'Operations & AI Team', 'agentmail', TRUE)
ON CONFLICT (email) DO NOTHING;

INSERT INTO contacts (id, name, email, company, role, tags, is_favorite, notes, source)
VALUES 
    ('c_alex', 'Alex Vance', 'alex.vance@blackmesa.tech', 'Black Mesa Research', 'Lead Architect', ARRAY['VIP', 'Engineering'], TRUE, 'Key partner for AI pipeline integration', 'inbox'),
    ('c_sarah', 'Sarah Connor', 'sarah.connor@cyberdyne.io', 'Cyberdyne Systems', 'VP of Security', ARRAY['Security', 'Executive'], TRUE, 'Review monthly security and compliance audit', 'manual'),
    ('c_elena', 'Dr. Elena Rostova', 'elena.rostova@quantum-labs.org', 'Quantum Dynamics', 'Chief AI Officer', ARRAY['AI', 'Advisor'], TRUE, 'Advising on autonomous email agent orchestration', 'agentmail')
ON CONFLICT (id) DO NOTHING;
