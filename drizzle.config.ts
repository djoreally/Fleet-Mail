import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/drizzleSchema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || 'postgresql://placeholder:placeholder@localhost:5432/neondb',
  },
  verbose: true,
  strict: true,
});
