import { serverConfig } from '../config.js';

export interface AIMessage {
  role: string;
  content: string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;
}

export async function callAICompletion(messages: AIMessage[], systemPrompt?: string) {
  const atlasKey = process.env.ATLASCLOUD_API_KEY;
  const formattedMessages = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...messages]
    : messages;

  if (atlasKey && atlasKey !== 'your-atlascloud-api-key' && atlasKey.trim() !== '') {
      const response = await fetch(`${serverConfig.atlasCloudBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${atlasKey.trim()}`,
        },
        body: JSON.stringify({
          model: serverConfig.atlasCloudModel,
          messages: formattedMessages,
          temperature: 0.7,
          max_tokens: 4096,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AtlasCloud API error:', response.status, errorText);
        throw new Error(`AtlasCloud API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      return {
        content: data.choices?.[0]?.message?.content || '',
        model: serverConfig.atlasCloudModel,
        provider: 'AtlasCloud AI',
      };
  }

  throw new Error('No AI API key configured. Please set ATLASCLOUD_API_KEY in your environment or Secrets.');
}
