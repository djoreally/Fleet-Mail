export interface TableDefinition {
  name: string;
  description: string;
  columns: { name: string; type: string; description: string; isPrimary?: boolean; isNullable?: boolean; defaultValue?: string }[];
  rlsPolicy: string;
}

const tenantTables = [
  'agentmail_pods','inboxes','agentmail_webhooks','customers','contacts','locations','vehicles',
  'technicians','resources','availability','work_orders','appointments','dispatch_assignments',
  'dispatch_status_history','inspections','authorizations','maintenance_schedules','maintenance_events',
  'parts','inventory','part_usage','estimates','invoices','invoice_line_items','payments','email_threads',
  'emails','email_summaries','documents','audit_events','chat_messages','agent_inbox_events','agent_runs',
];

export const SCHEMA_TABLES: TableDefinition[] = [
  { name:'organizations', description:'Fleet OS tenant accounts', columns:[{name:'id',type:'TEXT',description:'Tenant ID',isPrimary:true}], rlsPolicy:'Authenticated organization members; admin writes' },
  { name:'users', description:'Authentication subject mapping', columns:[{name:'id',type:'TEXT',description:'User ID',isPrimary:true},{name:'auth_subject',type:'TEXT',description:'Non-null identity-provider subject'}], rlsPolicy:'Exact authenticated subject only' },
  { name:'organization_memberships', description:'Tenant membership and roles', columns:[{name:'organization_id',type:'TEXT',description:'Tenant ID'},{name:'user_id',type:'TEXT',description:'Member user ID'},{name:'role',type:'TEXT',description:'owner, admin, dispatcher, technician, billing, or member'}], rlsPolicy:'Member reads; owner/admin writes' },
  ...tenantTables.map(name => ({ name, description:'Organization-scoped Fleet OS data', columns:[{name:'id',type:'TEXT',description:'Record ID',isPrimary:true},{name:'organization_id',type:'TEXT',description:'Required tenant boundary'}], rlsPolicy:'app.is_org_member(organization_id); no null/anonymous bypass' })),
];

export const RAW_SQL_MIGRATION = `-- Fleet OS uses generated Drizzle DDL plus checked-in RLS SQL.
-- 1. npm run db:generate
-- 2. Apply the generated migration.
-- 3. npm run db:migrate
-- Security policy source: src/db/migrations/0001_multitenant_rls.sql
-- Never make organization_id nullable and never add an IS NULL policy bypass.`;
