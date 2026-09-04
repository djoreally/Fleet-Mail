export const FLEET_ROLES = ['owner', 'admin', 'dispatcher', 'technician', 'viewer'] as const;
export type FleetRole = (typeof FLEET_ROLES)[number];

export const FLEET_PERMISSIONS = [
  'organization.view',
  'organization.manage',
  'team.view',
  'team.manage',
  'settings.view',
  'settings.manage',
  'fleet_accounts.view',
  'fleet_accounts.manage',
  'vehicles.view',
  'vehicles.manage',
  'schedule.view',
  'schedule.manage',
  'dispatch.view',
  'dispatch.manage',
  'work_orders.view',
  'work_orders.manage',
  'work_orders.execute',
  'inspections.view',
  'inspections.execute',
  'authorizations.view',
  'authorizations.manage',
  'financials.view',
  'financials.manage',
  'agreements.view',
  'agreements.manage',
  'prospects.view',
  'prospects.manage',
  'documents.view',
  'documents.manage',
  'inbox.view',
  'inbox.send',
  'agent.use',
  'agent.execute',
  'reports.view',
  'infrastructure.manage',
] as const;

export type FleetPermission = (typeof FLEET_PERMISSIONS)[number];

const ALL = new Set<FleetPermission>(FLEET_PERMISSIONS);

const ROLE_PERMISSIONS: Record<FleetRole, ReadonlySet<FleetPermission>> = {
  owner: ALL,
  admin: new Set(FLEET_PERMISSIONS.filter((permission) => permission !== 'organization.manage')),
  dispatcher: new Set([
    'organization.view', 'team.view', 'settings.view',
    'fleet_accounts.view', 'fleet_accounts.manage', 'vehicles.view', 'vehicles.manage',
    'schedule.view', 'schedule.manage', 'dispatch.view', 'dispatch.manage',
    'work_orders.view', 'work_orders.manage', 'authorizations.view', 'authorizations.manage',
    'inspections.view', 'agreements.view', 'prospects.view', 'prospects.manage',
    'documents.view', 'documents.manage', 'inbox.view', 'inbox.send',
    'agent.use', 'agent.execute', 'reports.view',
  ]),
  technician: new Set([
    'organization.view', 'fleet_accounts.view', 'vehicles.view', 'schedule.view', 'dispatch.view',
    'work_orders.view', 'work_orders.execute', 'inspections.view', 'inspections.execute',
    'authorizations.view', 'documents.view', 'documents.manage', 'agent.use',
  ]),
  viewer: new Set([
    'organization.view', 'fleet_accounts.view', 'vehicles.view', 'schedule.view', 'dispatch.view',
    'work_orders.view', 'inspections.view', 'authorizations.view', 'agreements.view',
    'prospects.view', 'documents.view', 'reports.view',
  ]),
};

const ROLE_ALIASES: Record<string, FleetRole> = {
  owner: 'owner',
  admin: 'admin',
  administrator: 'admin',
  dispatcher: 'dispatcher',
  dispatch: 'dispatcher',
  technician: 'technician',
  tech: 'technician',
  viewer: 'viewer',
  member: 'viewer',
  read_only: 'viewer',
  readonly: 'viewer',
};

export function normalizeFleetRole(value: unknown): FleetRole {
  const role = String(value ?? '').trim().toLowerCase();
  return ROLE_ALIASES[role] ?? 'viewer';
}

export function permissionsForRole(role: unknown): FleetPermission[] {
  return [...ROLE_PERMISSIONS[normalizeFleetRole(role)]];
}

export function fleetRoleHasPermission(role: unknown, permission: FleetPermission): boolean {
  return ROLE_PERMISSIONS[normalizeFleetRole(role)].has(permission);
}

export function fleetRoleHasAnyPermission(role: unknown, permissions: FleetPermission[]): boolean {
  return permissions.some((permission) => fleetRoleHasPermission(role, permission));
}
