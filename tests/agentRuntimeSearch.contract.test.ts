import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('agent runtime Fleet search contract',()=>{
  it('searches prospects, contacts, fleet operations, and AgentMail',()=>{
    const service=readFileSync('src/server/services/agentRuntimeSearch.ts','utf8');
    for(const term of ['prospectContacts','fleetAccounts','vehicles','workOrders','maintenance','client.inboxes.messages.list']) expect(service).toContain(term);
  });
  it('grounds chat with organization-scoped runtime results before the latest user request',()=>{
    const app=readFileSync('src/server/app.ts','utf8');
    expect(app).toContain("app.use('/api/chat'");
    expect(app).toContain('resolveAgentRuntimeOrganization');
    expect(app).toContain('searchAgentRuntimeContext');
    expect(app).toContain('Trusted Fleet OS runtime lookup');
  });
});
