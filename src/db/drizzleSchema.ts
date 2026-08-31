import { pgTable, text, boolean, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ============================================================================
// 1. Users Table - User profiles, authentication bindings, and preferences
// ============================================================================
export const users = pgTable(
  'users',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    email: text('email').notNull().unique(),
    name: text('name').notNull(),
    avatarUrl: text('avatar_url'),
    personalityFocus: text('personality_focus').default('Professional').notNull(),
    importantEmailsOnly: boolean('important_emails_only').default(true).notNull(),
    dailyAiDigest: boolean('daily_ai_digest').default(true).notNull(),
    connectedAccounts: jsonb('connected_accounts').default(sql`'[]'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_users_email').on(table.email),
    index('idx_users_created_at').on(table.createdAt),
  ]
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// ============================================================================
// 2. Inboxes Table - Connected AgentMail, Google, or Custom inboxes
// ============================================================================
export const inboxes = pgTable(
  'inboxes',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    email: text('email').notNull().unique(),
    name: text('name').notNull(),
    provider: text('provider').default('agentmail').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_inboxes_user_id').on(table.userId),
    index('idx_inboxes_email').on(table.email),
  ]
);

export type Inbox = typeof inboxes.$inferSelect;
export type NewInbox = typeof inboxes.$inferInsert;

// ============================================================================
// 3. Emails Table - Synced messages, AI summaries, action items & sentiment
// ============================================================================
export const emails = pgTable(
  'emails',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    inboxId: text('inbox_id'),
    threadId: text('thread_id'),
    fromAddress: text('from_address').notNull(),
    fromName: text('from_name'),
    avatarUrl: text('avatar_url'),
    toAddresses: text('to_addresses')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    subject: text('subject').notNull().default('(No Subject)'),
    textContent: text('text_content'),
    htmlContent: text('html_content'),
    isRead: boolean('is_read').default(false).notNull(),
    isStarred: boolean('is_starred').default(false).notNull(),
    actionRequired: text('action_required'),
    labels: text('labels')
      .array()
      .default(sql`'{}'::text[]`),
    summary: jsonb('summary'), // { tldr, actionItems, urgency, sentiment, suggestedReplies }
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_emails_user_id').on(table.userId),
    index('idx_emails_inbox_id').on(table.inboxId),
    index('idx_emails_thread_id').on(table.threadId),
    index('idx_emails_created_at').on(table.createdAt),
    index('idx_emails_is_read').on(table.isRead),
    index('idx_emails_is_starred').on(table.isStarred),
  ]
);

export type Email = typeof emails.$inferSelect;
export type NewEmail = typeof emails.$inferInsert;

// ============================================================================
// 4. Contacts Table - Address Book & CRM entries
// ============================================================================
export const contacts = pgTable(
  'contacts',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    email: text('email').notNull(),
    company: text('company'),
    role: text('role'),
    phone: text('phone'),
    avatarUrl: text('avatar_url'),
    tags: text('tags')
      .array()
      .default(sql`'{}'::text[]`),
    notes: text('notes'),
    lastContacted: timestamp('last_contacted', { withTimezone: true }),
    isFavorite: boolean('is_favorite').default(false).notNull(),
    source: text('source').default('manual').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_contacts_user_id').on(table.userId),
    index('idx_contacts_email').on(table.email),
    index('idx_contacts_is_favorite').on(table.isFavorite),
    index('idx_contacts_created_at').on(table.createdAt),
  ]
);

export type ContactRecord = typeof contacts.$inferSelect;
export type NewContactRecord = typeof contacts.$inferInsert;

// ============================================================================
// 5. Chat Messages Table - AI Copilot interactions, email drafts & invites
// ============================================================================
export const chatMessages = pgTable(
  'chat_messages',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull(), // 'user' | 'assistant' | 'system'
    content: text('content').notNull(),
    chips: text('chips')
      .array()
      .default(sql`'{}'::text[]`),
    calendarInvite: jsonb('calendar_invite'),
    emailDraft: jsonb('email_draft'),
    emailSummary: jsonb('email_summary'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_chat_messages_user_id').on(table.userId),
    index('idx_chat_messages_created_at').on(table.createdAt),
  ]
);

export type ChatMessageRecord = typeof chatMessages.$inferSelect;
export type NewChatMessageRecord = typeof chatMessages.$inferInsert;
