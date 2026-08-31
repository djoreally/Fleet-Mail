import { GoogleGenAI } from '@google/genai';
import { serverConfig } from '../config';

export interface AIMessage {
  role: string;
  content: string;
}

export async function callAICompletion(messages: AIMessage[], systemPrompt?: string) {
  const atlasKey = process.env.ATLASCLOUD_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const formattedMessages = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...messages]
    : messages;

  if (atlasKey && atlasKey !== 'your-atlascloud-api-key' && atlasKey.trim() !== '') {
    try {
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
    } catch (error: any) {
      console.warn('AtlasCloud call failed, attempting fallback if available:', error.message);
      if (!geminiKey) throw error;
    }
  }

  if (geminiKey) {
    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const promptContent = (systemPrompt ? `[SYSTEM INSTRUCTION]\n${systemPrompt}\n\n` : '')
      + messages.map((message) => `${message.role.toUpperCase()}: ${message.content}`).join('\n\n');
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: promptContent,
    });

    return {
      content: result.text || '',
      model: 'gemini-2.5-flash (Fallback)',
      provider: 'Google Gemini',
    };
  }

  throw new Error('No AI API key configured. Please set ATLASCLOUD_API_KEY in your environment or Secrets.');
}
