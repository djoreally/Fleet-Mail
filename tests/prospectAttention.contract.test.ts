import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('prospect follow-up intelligence contract',()=>{
  it('exposes an authenticated attention queue endpoint',()=>{
    const routes=readFileSync('src/server/routes/prospecting.ts','utf8');
    expect(routes).toContain("get('/prospects-attention'");
    expect(routes).toContain('prospectingService.attentionQueue(org)');
  });
  it('prioritizes replies, overdue follow-ups, quiet opportunities, and untouched qualified prospects',()=>{
    const service=readFileSync('src/server/services/prospecting.ts','utf8');
    expect(service).toContain("New inbound reply needs a response");
    expect(service).toContain("Follow-up is overdue");
    expect(service).toContain("Active opportunity has been quiet");
    expect(service).toContain("Qualified prospect has not been contacted");
    expect(service).toContain("suggestedNextAction");
  });
});
