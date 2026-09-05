import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { defaultWorkspaceTab, tabsForWorkspaceRole, workspaceAllowsTab } from '../src/lib/workspacePolicy';
import { fleetRoleHasPermission } from '../src/server/services/rbac';

describe('role workspace navigation boundary',()=>{
  it('lands dispatcher and technician in role-specific operational workspaces',()=>{
    expect(defaultWorkspaceTab('dispatcher')).toBe('dispatch');
    expect(defaultWorkspaceTab('technician')).toBe('work-orders');
  });

  it('prevents technician navigation into owner, dispatcher, sales, inbox and settings surfaces',()=>{
    for(const tab of ['dashboard','inbox','contacts','prospects','customers','dispatch','parts','financials','settings'] as const){
      expect(workspaceAllowsTab('technician',tab)).toBe(false);
    }
    expect(tabsForWorkspaceRole('technician')).toEqual(['work-orders','vehicles','schedule','documents','chat']);
  });

  it('keeps dispatcher operational while excluding owner settings and financial administration',()=>{
    expect(workspaceAllowsTab('dispatcher','dispatch')).toBe(true);
    expect(workspaceAllowsTab('dispatcher','schedule')).toBe(true);
    expect(workspaceAllowsTab('dispatcher','work-orders')).toBe(true);
    expect(workspaceAllowsTab('dispatcher','settings')).toBe(false);
    expect(workspaceAllowsTab('dispatcher','financials')).toBe(false);
    expect(fleetRoleHasPermission('dispatcher','settings.view')).toBe(false);
    expect(fleetRoleHasPermission('dispatcher','settings.manage')).toBe(false);
  });

  it('redirects a forbidden current tab from the sidebar instead of only hiding its menu item',()=>{
    const sidebar=readFileSync('src/components/Sidebar.tsx','utf8');
    expect(sidebar).toContain("if(access&&!workspaceAllowsTab(access.role,currentTab))onSelectTab(defaultWorkspaceTab(access.role))");
    expect(sidebar).toContain("tabAllowed('settings')&&allowed('settings.view')");
    expect(sidebar).toContain("tabAllowed('dashboard')&&");
  });
});
