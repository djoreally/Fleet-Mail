import { boolean, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { customers, organizations, users } from './drizzleSchema.js';

const id = () => text('id').primaryKey();
const organizationId = () => text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' });
const createdAt = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).defaultNow().notNull();

export const prospects = pgTable('prospects', {
  id: id(),
  organizationId: organizationId(),
  companyName: text('company_name').notNull(),
  website: text('website'),
  industry: text('industry'),
  phone: text('phone'),
  generalEmail: text('general_email'),
  address: jsonb('address').default(sql`'{}'::jsonb`).notNull(),
  serviceArea: text('service_area'),
  estimatedFleetSize: integer('estimated_fleet_size'),
  vehicleTypes: text('vehicle_types').array().default(sql`'{}'::text[]`).notNull(),
  source: text('source').default('manual').notNull(),
  sourceUrl: text('source_url'),
  stage: text('stage').default('new').notNull(),
  qualificationScore: integer('qualification_score').default(0).notNull(),
  ownerUserId: text('owner_user_id').references(() => users.id, { onDelete: 'set null' }),
  researchSummary: text('research_summary'),
  fleetEvidence: jsonb('fleet_evidence').default(sql`'[]'::jsonb`).notNull(),
  researchSources: jsonb('research_sources').default(sql`'[]'::jsonb`).notNull(),
  lastResearchedAt: timestamp('last_researched_at', { withTimezone: true }),
  lastContactedAt: timestamp('last_contacted_at', { withTimezone: true }),
  nextFollowUpAt: timestamp('next_follow_up_at', { withTimezone: true }),
  opportunityValue: numeric('opportunity_value', { precision: 12, scale: 2 }),
  probability: integer('probability').default(0).notNull(),
  lostReason: text('lost_reason'),
  convertedCustomerId: text('converted_customer_id').references(() => customers.id, { onDelete: 'set null' }),
  convertedAt: timestamp('converted_at', { withTimezone: true }),
  notes: text('notes'),
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, table => [
  index('prospects_org_stage_idx').on(table.organizationId, table.stage),
  index('prospects_org_score_idx').on(table.organizationId, table.qualificationScore),
  index('prospects_org_follow_up_idx').on(table.organizationId, table.nextFollowUpAt),
  uniqueIndex('prospects_org_website_uq').on(table.organizationId, table.website),
]);

export const prospectContacts = pgTable('prospect_contacts', {
  id: id(),
  organizationId: organizationId(),
  prospectId: text('prospect_id').notNull().references(() => prospects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  title: text('title'),
  isDecisionMaker: boolean('is_decision_maker').default(false).notNull(),
  sourceUrl: text('source_url'),
  confidence: integer('confidence').default(0).notNull(),
  notes: text('notes'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, table => [
  index('prospect_contacts_org_prospect_idx').on(table.organizationId, table.prospectId),
  index('prospect_contacts_org_email_idx').on(table.organizationId, table.email),
]);

export const prospectActivities = pgTable('prospect_activities', {
  id: id(),
  organizationId: organizationId(),
  prospectId: text('prospect_id').notNull().references(() => prospects.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  direction: text('direction'),
  channel: text('channel'),
  subject: text('subject'),
  summary: text('summary'),
  externalMessageId: text('external_message_id'),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`).notNull(),
  createdAt: createdAt(),
}, table => [
  index('prospect_activities_org_prospect_idx').on(table.organizationId, table.prospectId, table.occurredAt),
  index('prospect_activities_external_message_idx').on(table.organizationId, table.externalMessageId),
]);
