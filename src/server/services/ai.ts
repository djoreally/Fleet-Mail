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

const ATLAS_FALLBACK_CHAT_MODEL = 'deepseek-ai/deepseek-v3.2';

function contentText(content: unknown) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return content == null ? '' : JSON.stringify(content);
  return content.map((part: any) => part?.type === 'text' ? String(part.text || '') : '').filter(Boolean).join('\n');
}

function anthropicContent(content: unknown) {
  if (typeof content === 'string') return [{ type: 'text', text: content }];
  if (!Array.isArray(content)) return [{ type: 'text', text: content == null ? '' : JSON.stringify(content) }];
  const blocks: any[] = [];
  for (const part of content as any[]) {
    if (part?.type === 'text') {
      blocks.push({ type: 'text', text: String(part.text || '') });
      continue;
    }
    if (part?.type === 'image_url') {
      const url = String(part?.image_url?.url || '');
      const data = url.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/i);
      if (data) blocks.push({ type: 'image', source: { type: 'base64', media_type: data[1].toLowerCase(), data: data[2] } });
      else if (/^https:\/\//i.test(url)) blocks.push({ type: 'image', source: { type: 'url', url } });
    }
  }
  return blocks.length ? blocks : [{ type: 'text', text: '' }];
}

function toAnthropicMessages(messages: AIMessage[]) {
  const output: any[] = [];
  for (const message of messages) {
    if (message.role === 'system') continue;
    if (message.role === 'tool') {
      const block = {
        type: 'tool_result',
        tool_use_id: String(message.tool_call_id || ''),
        content: typeof message.content === 'string' ? message.content : JSON.stringify(message.content ?? null),
      };
      const previous = output.at(-1);
      if (previous?.role === 'user' && Array.isArray(previous.content) && previous.content.every((item: any) => item?.type === 'tool_result')) {
        previous.content.push(block);
      } else {
        output.push({ role: 'user', content: [block] });
      }
      continue;
    }
    if (message.role === 'assistant' && Array.isArray(message.tool_calls) && message.tool_calls.length) {
      const blocks: any[] = [];
      const text = contentText(message.content);
      if (text) blocks.push({ type: 'text', text });
      for (const call of message.tool_calls) {
        let input: Record<string, unknown> = {};
        try {
          const parsed = JSON.parse(call.function.arguments || '{}');
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) input = parsed;
        } catch { input = {}; }
        blocks.push({ type: 'tool_use', id: call.id, name: call.function.name, input });
      }
      output.push({ role: 'assistant', content: blocks });
      continue;
    }
    output.push({ role: message.role === 'assistant' ? 'assistant' : 'user', content: anthropicContent(message.content) });
  }
  return output;
}

async function callAtlasToolCompletion(atlasKey: string, messages: AIMessage[], systemPrompt: string | undefined, options: AICompletionOptions) {
  const tools = Array.isArray(options.tools) ? options.tools : [];
  const embeddedSystem = messages.filter((message) => message.role === 'system').map((message) => contentText(message.content)).filter(Boolean);
  const system = [systemPrompt, ...embeddedSystem].filter(Boolean).join('\n\n');
  const response = await fetch(`${serverConfig.atlasCloudBaseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${atlasKey.trim()}`,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: serverConfig.atlasCloudToolModel,
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature ?? 0.2,
      ...(system ? { system } : {}),
      messages: toAnthropicMessages(messages),
      ...(tools.length ? {
        tools: tools.map((tool) => ({
          name: tool.function.name,
          description: tool.function.description,
          input_schema: tool.function.parameters,
        })),
        tool_choice: { type: options.toolChoice ?? 'auto' },
      } : {}),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('AtlasCloud tool API error:', response.status, errorText);
    throw new Error(`AtlasCloud tool API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const blocks = Array.isArray(data.content) ? data.content : [];
  const toolCalls: AIToolCall[] = blocks
    .filter((block: any) => block?.type === 'tool_use' && block?.name)
    .map((block: any, index: number) => ({
      id: String(block.id || `tool_${index}`),
      type: 'function' as const,
      function: { name: String(block.name), arguments: JSON.stringify(block.input || {}) },
    }));
  const content = blocks.filter((block: any) => block?.type === 'text').map((block: any) => String(block.text || '')).join('');

  return {
    content,
    toolCalls,
    finishReason: data.stop_reason || null,
    model: data.model || serverConfig.atlasCloudToolModel,
    provider: 'AtlasCloud AI',
  };
}

async function callAtlasChat(atlasKey: string, model: string, messages: AIMessage[], options: AICompletionOptions) {
  return fetch(`${serverConfig.atlasCloudBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${atlasKey.trim()}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 4096,
    }),
  });
}

export async function callAICompletion(messages: AIMessage[], systemPrompt?: string, options: AICompletionOptions = {}) {
  const atlasKey = process.env.ATLASCLOUD_API_KEY;
  if (!atlasKey || atlasKey === 'your-atlascloud-api-key' || atlasKey.trim() === '') {
    throw new Error('No AI API key configured. Please set ATLASCLOUD_API_KEY in your environment or Secrets.');
  }

  const tools = Array.isArray(options.tools) ? options.tools : [];
  const hasToolHistory = messages.some((message) => message.role === 'tool' || (Array.isArray(message.tool_calls) && message.tool_calls.length > 0));
  if (tools.length || hasToolHistory) {
    return callAtlasToolCompletion(atlasKey, messages, systemPrompt, options);
  }

  const formattedMessages: AIMessage[] = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...messages]
    : messages;

  let model = serverConfig.atlasCloudModel;
  let response = await callAtlasChat(atlasKey, model, formattedMessages, options);
  let firstError = '';

  if (!response.ok && [400, 404, 422].includes(response.status) && model !== ATLAS_FALLBACK_CHAT_MODEL) {
    firstError = await response.text();
    console.warn(`AtlasCloud chat model ${model} rejected request (${response.status}); retrying with ${ATLAS_FALLBACK_CHAT_MODEL}.`);
    model = ATLAS_FALLBACK_CHAT_MODEL;
    response = await callAtlasChat(atlasKey, model, formattedMessages, options);
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error('AtlasCloud API error:', response.status, errorText);
    const context = firstError ? ` Primary model error: ${firstError}` : '';
    throw new Error(`AtlasCloud API error (${response.status}): ${errorText}${context}`);
  }

  const data = await response.json();
  const message = data.choices?.[0]?.message || {};
  return {
    content: typeof message.content === 'string' ? message.content : '',
    toolCalls: [] as AIToolCall[],
    finishReason: data.choices?.[0]?.finish_reason || null,
    model: data.model || model,
    provider: 'AtlasCloud AI',
  };
}
