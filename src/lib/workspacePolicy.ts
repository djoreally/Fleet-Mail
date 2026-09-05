export type WorkspaceTab = 'dashboard' | 'inbox' | 'sent' | 'drafts' | 'contacts' | 'chat' | 'settings'
  | 'vehicles' | 'work-orders' | 'maintenance' | 'dispatch' | 'parts' | 'prospects' | 'customers'
  | 'schedule' | 'financials' | 'documents';

const ALL_TABS: WorkspaceTab[] = [
  'dashboard','inbox','sent','drafts','contacts','chat','settings','vehicles','work-orders','maintenance',
  'dispatch','parts','prospects','customers','schedule','financials','documents',
];

const DISPATCHER_TABS: WorkspaceTab[] = [
  'dashboard','inbox','sent','drafts','contacts','chat','prospects','customers','vehicles','work-orders',
  'maintenance','schedule','dispatch','parts','documents',
];

const TECHNICIAN_TABS: WorkspaceTab[] = [
  'work-orders','vehicles','schedule','documents','chat',
];

const VIEWER_TABS: WorkspaceTab[] = [
  'dashboard','prospects','customers','vehicles','work-orders','schedule','dispatch','documents','financials',
];

export function tabsForWorkspaceRole(role: string): WorkspaceTab[] {
  const normalized = String(role || '').toLowerCase();
  if (normalized === 'technician') return TECHNICIAN_TABS;
  if (normalized === 'dispatcher') return DISPATCHER_TABS;
  if (normalized === 'viewer') return VIEWER_TABS;
  return ALL_TABS;
}

export function workspaceAllowsTab(role: string, tab: WorkspaceTab): boolean {
  return tabsForWorkspaceRole(role).includes(tab);
}

export function defaultWorkspaceTab(role: string): WorkspaceTab {
  const normalized = String(role || '').toLowerCase();
  if (normalized === 'technician') return 'work-orders';
  if (normalized === 'dispatcher') return 'dispatch';
  return 'dashboard';
}
