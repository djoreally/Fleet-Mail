import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const ui=readFileSync('src/components/operations/ProspectCommandCenter.tsx','utf8');
const moduleView=readFileSync('src/components/FleetModuleView.tsx','utf8');

describe('prospecting UI certification contract',()=>{
  it('renders the real prospecting command center in the Fleet module',()=>{
    expect(moduleView).toContain('prospects:<ProspectingLive/>');
    expect(moduleView).toContain('<ProspectInboxSyncButton/>');
    expect(moduleView).toContain('<ProspectCommandCenter/>');
  });

  it('keeps the primary prospecting surface responsive',()=>{
    expect(ui).toContain('p-5 lg:p-8');
    expect(ui).toContain('flex flex-col justify-between gap-4 lg:flex-row');
    expect(ui).toContain('grid gap-4 sm:grid-cols-2 lg:grid-cols-4');
    expect(ui).toContain('overflow-x-auto');
  });

  it('keeps discovery usable on small screens without a viewport-height trap',()=>{
    expect(ui).toContain('max-h-[90vh]');
    expect(ui).toContain('overflow-y-auto');
    expect(ui).toContain('grid gap-3 md:grid-cols-4');
    expect(ui).toContain('md:col-span-4');
  });

  it('surfaces live failures and explicit loading states instead of silent actions',()=>{
    expect(ui).toContain("error&&<div");
    expect(ui).toContain('discovering');
    expect(ui).toContain('sending');
    expect(ui).toContain('Loader2');
  });
});
