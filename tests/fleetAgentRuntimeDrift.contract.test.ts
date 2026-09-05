import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Fleet Agent runtime drift guardrails', () => {
  const app = readFileSync('src/server/app.ts', 'utf8');
  const runtime = readFileSync('src/server/services/fleetAgentRuntime.ts', 'utf8');
  const api = readFileSync('src/server/routes/api.ts', 'utf8');

  it('keeps Browserbase as the canonical research platform and Firecrawl as fallback only', () => {
    expect(runtime).toContain('Browserbase Search/Fetch is the primary public-web research path.');
    expect(runtime).toContain('Firecrawl is compatibility fallback only when Browserbase research is unavailable.');
    expect(runtime).not.toContain('Browserbase is explicit-action-only');
    expect(runtime).not.toContain('Firecrawl is the research tool');
  });

  it('prevents the legacy apiRouter chat handler from ever becoming reachable', () => {
    expect(api).toContain("apiRouter.post('/chat'");
    expect(app).toContain("app.use('/api/chat',tenantChatRouter)");
    expect(app).toContain("app.use('/api/chat',(req,res)=>req.method==='POST'?res.status(410).json({error:'Legacy chat route is disabled'}):res.status(404).end())");
    expect(app.indexOf("app.use('/api/chat',tenantChatRouter)")).toBeLessThan(app.indexOf("app.use('/api',dashboardRouter)"));
  });
});
