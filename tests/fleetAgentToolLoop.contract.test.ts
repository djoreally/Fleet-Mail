import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const loop = readFileSync('src/server/services/fleetAgentLoop.ts', 'utf8');
const ai = readFileSync('src/server/services/ai.ts', 'utf8');
const config = readFileSync('src/server/config.ts', 'utf8');
const chat = readFileSync('src/server/routes/chat.ts', 'utf8');
const ledgerSearch = readFileSync('src/server/services/fleetAuditSearch.ts', 'utf8');

const hasPair=(source:string,key:string,value:string)=>new RegExp(`${key}\\s*:\\s*['\"]${value.replaceAll('.','\\.')}['\"]`).test(source);
const hasName=(name:string)=>new RegExp(`name\\s*:\\s*['\"]${name}['\"]`).test(loop);

describe('Fleet Agent bounded tool loop contract', () => {
  it('supports structured model tool calls and feeds tool results back into the conversation', () => {
    expect(ai).toContain("type: 'tool_use'");expect(ai).toContain("type: 'tool_result'");expect(ai).toContain('tool_use_id');
    expect(/MAX_TOOL_ROUNDS\s*=\s*5/.test(loop)).toBe(true);expect(/role\s*:\s*['\"]tool['\"]/.test(loop)).toBe(true);expect(loop).toContain('tool_call_id');expect(/round\s*=\s*0;round<MAX_TOOL_ROUNDS;round\+=1/.test(loop.replaceAll(' ',''))).toBe(true);
  });
  it('uses AtlasCloud Anthropic Messages for tool-capable turns and keeps ordinary chat separate', () => {
    expect(config).toContain("atlasCloudToolModel: process.env.ATLASCLOUD_TOOL_MODEL || 'deepseek-ai/deepseek-v3.2'");expect(ai).toContain("`${serverConfig.atlasCloudBaseUrl}/messages`");expect(ai).toContain("'anthropic-version': '2023-06-01'");expect(ai).toContain('input_schema: tool.function.parameters');expect(ai).toContain("`${serverConfig.atlasCloudBaseUrl}/chat/completions`");expect(ai).toContain('if (tools.length || hasToolHistory)');
  });
  it('keeps Fleet reads tenant-scoped through existing server-owned services', () => {
    expect(loop).toContain('searchAgentRuntimeContext(organizationId');expect(loop).toContain('searchAgentOperationalContext(organizationId');expect(loop).toContain('getFleetKnowledgeContext(organizationId');expect(loop).toContain('searchFleetChangeLedger(organizationId');expect(loop).toContain('financialReadModelService.dashboard(organizationId)');expect(loop).toContain('maintenanceIntelligenceService.attention(organizationId)');expect(chat).toContain('requireFleetOrganization(req)');expect(ledgerSearch).toContain('eq(auditEvents.organizationId, organizationId)');
  });
  it('exposes fuzzy Fleet knowledge and durable change ledger read tools', () => {expect(loop).toContain("queryTool('search_fleet_knowledge'");expect(loop).toContain("queryTool('search_change_ledger'");expect(loop).toContain('Fuzzy-search the tenant Fleet knowledge directory');expect(ledgerSearch).toContain("source: 'audit_events'");});
  it('exposes Browserbase/NHTSA capabilities without raw provider or database control', () => {expect(loop).toContain('executeWebCapability');for(const name of ['research_web','browse_web','prepare_web_form','decode_vin'])expect(hasName(name)).toBe(true);expect(chat).toContain('Do not narrate provider selection');});
  it('never auto-executes consequential mutations', () => {
    expect(hasPair(loop,'send_email','email.send')).toBe(true);expect(hasPair(loop,'create_work_order','fleet.work_order.create')).toBe(true);expect(/createAgentActionProposal\(mutationKind\s*,\s*args\s*,\s*input\.organizationId\)/.test(loop)).toBe(true);expect(/status\s*:\s*['\"]confirmation_required['\"]/.test(loop)).toBe(true);expect(loop).not.toContain('executeAgentAction(');expect(chat).toContain('Consequential mutations are NEVER automatic');
  });
  it('returns loop trace and bounded rounds for certification without exposing internals in visible text', () => {expect(chat).toContain('toolExecution: { rounds: agentResult.rounds, trace: agentResult.toolTrace }');expect(chat).toContain("'bounded-tool-loop'");expect(chat).toContain('plain human-readable text');});
});
