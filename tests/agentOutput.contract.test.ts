import { describe, expect, it } from 'vitest';
import { formatAgentPlainText } from '../src/server/services/agentSkills.js';

describe('Fleet agent visible output', () => {
  it('removes leaked provider/tool invocation markup', () => {
    const raw = `I am checking that page.\n<dots_function_call>\n<invoke=\"firecrawl\">\n{"url":"https://example.com"}\n</invoke>\n</dots_function_call>\nI found the fleet page.`;
    const output = formatAgentPlainText(raw);
    expect(output).not.toContain('dots_function_call');
    expect(output).not.toContain('<invoke');
    expect(output).not.toContain('firecrawl');
    expect(output).toContain('I found the fleet page.');
  });

  it('continues to hide structured action review blocks', () => {
    const raw = `Draft ready.\n\`\`\`json:agent_action\n{"kind":"email.send","payload":{}}\n\`\`\``;
    expect(formatAgentPlainText(raw)).toBe('Draft ready.');
  });
});
