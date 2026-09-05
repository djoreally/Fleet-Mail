import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('agent runtime Fleet search contract',()=>{
  it('searches prospects, contacts, fleet operations, and AgentMail',()=>{
    const service=readFileSync('src/server/services/agentRuntimeSearch.ts','utf8');
    for(const term of ['prospectContacts','fleetAccounts','vehicles','workOrders','maintenance','client.inboxes.messages.list']) expect(service).toContain(term);
  });
  it('grounds chat only after verified organization access',()=>{
    const app=readFileSync('src/server/app.ts','utf8').replace(/\s+/g,'');
    const runtime=readFileSync('src/server/services/fleetAgentRuntime.ts','utf8');
    expect(app).toContain("app.use('/api/chat',requireFleetSession)");
    expect(runtime).toContain('requireFleetOrganization(req)');
    expect(runtime).not.toContain('resolveAgentRuntimeOrganization');
    expect(runtime).toContain('searchAgentRuntimeContext');
    expect(runtime).toContain('Trusted live Fleet OS tool results');
    expect(runtime).toContain('Trusted Fleet Knowledge Layer');
  });
});
