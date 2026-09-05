import { serverConfig } from '../config.js';

export interface AIToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface AIToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface AIMessage {
  role: string;
  content: unknown;
  tool_calls?: AIToolCall[];
  tool_call_id?: string;
}

export interface AICompletionOptions {
  tools?: AIToolDefinition[];
  toolChoice?: 'auto' | 'none';
  temperature?: number;
  maxTokens?: number;
}

export async function callAICompletion(messages: AIMessage[], systemPrompt?: string, options: AICompletionOptions = {}) {
  const atlasKey = process.env.ATLASCLOUD_API_KEY;
  const formattedMessages = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...messages]
    : messages;

  if (atlasKey && atlasKey !== 'your-atlascloud-api-key' && atlasKey.trim() !== '') {
    const tools = Array.isArray(options.tools) ? options.tools : [];
    const response = await fetch(`${serverConfig.atlasCloudBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${atlasKey.trim()}`,
      },
      body: JSON.stringify({
        model: serverConfig.atlasCloudModel,
        messages: formattedMessages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 4096,
        ...(tools.length ? { tools, tool_choice: options.toolChoice ?? 'auto' } : {}),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AtlasCloud API error:', response.status, errorText);
      throw new Error(`AtlasCloud API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message || {};
    const toolCalls: AIToolCall[] = Array.isArray(message.tool_calls)
      ? message.tool_calls
          .filter((call: any) => call?.type === 'function' && call?.function?.name)
          .map((call: any, index: number) => ({
            id: String(call.id || `tool_${index}`),
            type: 'function' as const,
            function: {
              name: String(call.function.name || ''),
              arguments: typeof call.function.arguments === 'string' ? call.function.arguments : JSON.stringify(call.function.arguments || {}),
            },
          }))
      : [];

    return {
      content: typeof message.content === 'string' ? message.content : '',
      toolCalls,
      finishReason: data.choices?.[0]?.finish_reason || null,
      model: data.model || serverConfig.atlasCloudModel,
      provider: 'AtlasCloud AI',
    };
  }

  throw new Error('No AI API key configured. Please set ATLASCLOUD_API_KEY in your environment or Secrets.');
}
