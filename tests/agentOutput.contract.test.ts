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

  it('removes generic function_calls and tool_call wrappers', () => {
    const raw = `Checking internal records.\n<function_calls>\n<function_call name="contacts.search">{"q":"Zachary"}</function_call>\n</function_calls>\nZachary is in your contact history.`;
    const output = formatAgentPlainText(raw);
    expect(output).not.toContain('function_calls');
    expect(output).not.toContain('function_call');
    expect(output).not.toContain('contacts.search');
    expect(output).toContain('Zachary is in your contact history.');
  });

  it('removes encoded tool markup and orphan invocation tags', () => {
    const raw = `&lt;tool_call name="search"&gt;payload&lt;/tool_call&gt;\n<invoke name="browser">secret payload</invoke>\nDone.`;
    const output = formatAgentPlainText(raw);
    expect(output).not.toMatch(/tool_call|invoke|secret payload/i);
    expect(output).toContain('Done.');
  });

  it('continues to hide structured action review blocks', () => {
    const raw = `Draft ready.\n\`\`\`json:agent_action\n{"kind":"email.send","payload":{}}\n\`\`\``;
    expect(formatAgentPlainText(raw)).toBe('Draft ready.');
  });
});
