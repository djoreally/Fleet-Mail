import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('AgentMail prospect webhook contract',()=>{
 it('captures raw JSON before the general JSON parser and verifies Svix headers',()=>{const app=readFileSync('src/server/app.ts','utf8');expect(app.indexOf("app.post('/api/webhooks/agentmail'")).toBeLessThan(app.indexOf("const jsonParser=express.json"));expect(app).toContain('verifyAgentMailWebhook');});
 it('maps inbound replies to Fleet prospects and advances engagement',()=>{const service=readFileSync('src/server/services/prospectWebhook.ts','utf8');expect(service).toContain("message.received");expect(service).toContain('externalInboxId');expect(service).toContain("kind:'reply_email'");expect(service).toContain("?'engaged'");expect(service).toContain('nextFollowUpAt:new Date()');});
});
