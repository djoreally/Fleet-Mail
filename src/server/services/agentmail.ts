import { AgentMailClient } from 'agentmail';

let clientInstance: AgentMailClient | null = null;

export function getAgentMailClient(): AgentMailClient | null {
  const apiKey = process.env.AGENTMAIL_API_KEY;
  if (!apiKey || apiKey === 'your-agentmail-api-key' || apiKey.trim() === '') {
    return null;
  }

  if (!clientInstance) {
    clientInstance = new AgentMailClient({ apiKey: apiKey.trim() });
  }

  return clientInstance;
}
