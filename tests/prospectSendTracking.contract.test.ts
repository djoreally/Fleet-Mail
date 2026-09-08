import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const actions=readFileSync('src/server/routes/agentActions.ts','utf8');
const outreach=readFileSync('src/server/services/prospectOutreach.ts','utf8');
const hasPermission=(permission:string)=>new RegExp(`requireFleetPermission\\(req,\\s*['\"]${permission}['\"]\\)`).test(actions);

describe('prospect send and tracking contract',()=>{
  it('requires explicit confirmation and both execution/send permissions',()=>{
    expect(/req\.body\?\.confirmed\s*!==\s*true/.test(actions)).toBe(true);
    expect(hasPermission('agent.execute')).toBe(true);
    expect(hasPermission('inbox.send')).toBe(true);
  });
  it('records outreach only after AgentMail reports send success',()=>{
    const sendIndex=actions.indexOf('client.inboxes.messages.send');
    const recordIndex=actions.indexOf('prospectOutreachService.recordSent');
    const finishIndex=actions.indexOf('return finish(result)',sendIndex);
    expect(sendIndex).toBeGreaterThan(-1);expect(recordIndex).toBeGreaterThan(sendIndex);expect(finishIndex).toBeGreaterThan(recordIndex);
  });
  it('persists provider message identity and advances contact state durably',()=>{
    expect(actions).toContain('externalMessageId');expect(outreach).toContain("kind:'outreach_email'");expect(outreach).toContain("direction:'outbound'");expect(outreach).toContain("channel:'agentmail'");expect(outreach).toContain('lastContactedAt:new Date()');
  });
  it('marks claimed action executions failed when downstream send/tracking throws',()=>{
    expect(actions).toContain('markAgentActionFailed');
    expect(/if\s*\(\s*claimed\s*&&\s*proposalId\s*&&\s*organizationId\s*\)/.test(actions)).toBe(true);
  });
});
