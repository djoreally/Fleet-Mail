import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Prepared prospect draft UI contract',()=>{
  const ui=readFileSync('src/components/operations/ProspectCommandCenter.tsx','utf8');
  const routes=readFileSync('src/server/routes/agentObservability.ts','utf8');

  it('lets owner/admin prepare queued follow-ups from the prospect attention panel',()=>{
    expect(ui).toContain('Prepare follow-ups');
    expect(ui).toContain('/api/agent/queue/prospects');
    expect(ui).toContain('/api/agent/queue/process');
    expect(ui).toContain("['owner','admin']");
  });

  it('shows prepared drafts and requires a fresh signed proposal before send',()=>{
    expect(ui).toContain('Prepared');
    expect(ui).toContain('Review draft');
    expect(ui).toContain('/propose-send');
    expect(routes).toContain("createAgentActionProposal('email.send'");
    expect(routes).toContain("run.kind!=='prospect_followup_draft'");
    expect(routes).toContain("run.status!=='succeeded'");
  });

  it('consumes a prepared result only after the existing confirmation-gated send succeeds',()=>{
    const execute=ui.indexOf("'/api/agent/actions/execute'");
    const consume=ui.indexOf('/consume');
    expect(execute).toBeGreaterThan(-1);
    expect(consume).toBeGreaterThan(execute);
    expect(routes).toContain('consumedAt');
  });
});
