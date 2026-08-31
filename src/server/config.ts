import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_NEON_DATA_API_URL = 'https://ep-sparkling-pine-afqf3sia.apirest.c-2.us-west-2.aws.neon.tech/neondb/rest/v1';
const DEFAULT_NEON_AUTH_URL = 'https://ep-sparkling-pine-afqf3sia.neonauth.c-2.us-west-2.aws.neon.tech/neondb/auth';

export const serverConfig = {
  port: Number(process.env.PORT) || 3000,
  host: process.env.HOST || '0.0.0.0',
  atlasCloudBaseUrl: 'https://api.atlascloud.ai/v1',
  atlasCloudModel: 'dots-studio/dots-3-note-prev-free',
  agentMailBaseUrl: 'https://api.agentmail.to/v0',
  defaultInbox: process.env.DEFAULT_INBOX || 'moms@agentmail.to',
  neonDataApiUrl: process.env.NEON_DATA_API_URL || process.env.VITE_NEON_DATA_API_URL || DEFAULT_NEON_DATA_API_URL,
  neonAuthUrl: process.env.NEON_AUTH_URL || process.env.VITE_NEON_AUTH_URL || DEFAULT_NEON_AUTH_URL,
} as const;
