import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Fleet Agent runtime drift guardrails', () => {
  const app = readFileSync('src/server/app.ts', 'utf8');
  const runtime = readFileSync('src/server/services/fleetAgentRuntime.ts', 'utf8');
  const loop = readFileSync('src/server/services/fleetAgentLoop.ts', 'utf8');
  const webRouter = readFileSync('src/server/services/webCapabilityRouter.ts', 'utf8');
  const api = readFileSync('src/server/routes/api.ts', 'utf8');

  it('keeps Browserbase as the canonical research platform and Firecrawl as fallback only', () => {
    expect(runtime).toContain('Browserbase Search is the primary discovery path for public-web research.');
    expect(runtime).toContain('Browserbase Fetch is the lightweight page-retrieval path.');
    expect(runtime).toContain('Firecrawl is compatibility fallback only when Browserbase research is unavailable.');
    expect(loop).toContain('executeWebCapability');
    expect(webRouter.indexOf('process.env.BROWSERBASE_API_KEY')).toBeLessThan(webRouter.indexOf('process.env.FIRECRAWL_API_KEY'));
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
