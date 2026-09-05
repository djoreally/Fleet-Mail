import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const loop = readFileSync('src/server/services/fleetAgentLoop.ts', 'utf8');
const ai = readFileSync('src/server/services/ai.ts', 'utf8');
const chat = readFileSync('src/server/routes/chat.ts', 'utf8');

describe('Fleet Agent bounded tool loop contract', () => {
  it('supports structured model tool calls and feeds tool results back into the conversation', () => {
    expect(ai).toContain('tool_calls');
    expect(ai).toContain('tool_choice');
    expect(loop).toContain('MAX_TOOL_ROUNDS = 5');
    expect(loop).toContain("role: 'tool'");
    expect(loop).toContain('tool_call_id');
    expect(loop).toContain('for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1)');
  });

  it('keeps Fleet reads tenant-scoped through existing server-owned services', () => {
    expect(loop).toContain('searchAgentRuntimeContext(organizationId');
    expect(loop).toContain('searchAgentOperationalContext(organizationId');
    expect(loop).toContain('financialReadModelService.dashboard(organizationId)');
    expect(loop).toContain('maintenanceIntelligenceService.attention(organizationId)');
    expect(chat).toContain('requireFleetOrganization(req)');
  });

  it('exposes Browserbase/NHTSA capabilities without raw provider or database control', () => {
    expect(loop).toContain('executeWebCapability');
    expect(loop).toContain("name: 'research_web'");
    expect(loop).toContain("name: 'browse_web'");
    expect(loop).toContain("name: 'prepare_web_form'");
    expect(loop).toContain("name: 'decode_vin'");
    expect(chat).toContain('Do not narrate provider selection');
  });

  it('never auto-executes consequential mutations', () => {
    expect(loop).toContain("send_email: 'email.send'");
    expect(loop).toContain("create_work_order: 'fleet.work_order.create'");
    expect(loop).toContain('createAgentActionProposal(mutationKind, args, input.organizationId)');
    expect(loop).toContain("status: 'confirmation_required'");
    expect(loop).not.toContain('executeAgentAction(');
    expect(chat).toContain('Consequential mutations are NEVER automatic');
  });

  it('returns loop trace and bounded rounds for certification without exposing internals in visible text', () => {
    expect(chat).toContain('toolExecution: { rounds: agentResult.rounds, trace: agentResult.toolTrace }');
    expect(chat).toContain("'bounded-tool-loop'");
    expect(chat).toContain('plain human-readable text');
  });
});
