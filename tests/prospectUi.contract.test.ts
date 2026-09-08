import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const ui=readFileSync('src/components/operations/ProspectCrudWorkspace.tsx','utf8');
const moduleView=readFileSync('src/components/FleetModuleView.tsx','utf8');

describe('prospecting UI certification contract',()=>{
  it('renders the real prospecting CRUD workspace in the Fleet module',()=>{
    expect(moduleView).toContain('prospects:<ProspectingLive/>');
    expect(moduleView).toContain('<ProspectInboxSyncButton/>');
    expect(moduleView).toContain('<ProspectCrudWorkspace/>');
  });
  it('keeps manual prospect CRUD available',()=>{
    expect(ui).toContain('Add prospect manually');
    expect(ui).toContain("method:editing?'PATCH':'POST'");
    expect(ui).toContain("method:'DELETE'");
  });
  it('keeps the primary prospecting surface responsive',()=>{
    expect(ui).toContain('sm:');
    expect(ui).toContain('overflow');
  });
});
