import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Prospect agent queue contract',()=>{
  const migration=readFileSync('src/db/migrations/0012_agent_run_queue.sql','utf8');
  const service=readFileSync('src/server/services/prospectAgentQueue.ts','utf8');
  const routes=readFileSync('src/server/routes/agentObservability.ts','utf8');

  it('adds leaseable retryable queue fields',()=>{
    for(const field of ['available_at','attempts','max_attempts','locked_at','locked_by'])expect(migration).toContain(field);
    expect(migration).toContain("WHERE status = 'queued'");
  });

  it('queues prospect follow-up preparation without autonomous sending',()=>{
    expect(service).toContain("kind:'prospect_followup_draft'");
    expect(service).toContain("status:'queued'");
    expect(service).toContain("sendRequiresConfirmation:true");
    expect(service).not.toContain('sendEmail');
    expect(service).not.toContain('agentMailService');
  });

  it('claims work atomically and retries failures with a bounded attempt count',()=>{
    expect(service).toContain('FOR UPDATE SKIP LOCKED');
    expect(service).toContain('attempts<max_attempts');
    expect(service).toContain("interval '15 minutes'");
    expect(service).toContain("retry?'queued':'failed'");
  });

  it('keeps queue control owner/admin scoped',()=>{
    expect(routes).toContain("post('/queue/prospects'");
    expect(routes).toContain("post('/queue/process'");
    expect(routes.match(/requireFleetRole\(req,\['owner','admin'\]\)/g)?.length).toBeGreaterThanOrEqual(4);
  });
});
