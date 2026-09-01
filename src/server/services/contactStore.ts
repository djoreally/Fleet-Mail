import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../../db/index.js';
import { contacts } from '../../db/drizzleSchema.js';

export function contactRepository() {
  const database = getDb();
  if (!database) throw new Error('DATABASE_URL is required');
  return {
    list: (organizationId: string) => database.select().from(contacts).where(eq(contacts.organizationId, organizationId)),
    getById: async (organizationId: string, id: string) => (await database.select().from(contacts).where(and(eq(contacts.organizationId, organizationId), eq(contacts.id, id))).limit(1))[0] || null,
    upsert: async (organizationId: string, value: Record<string, any>) => {
      const fields = { name: String(value.name || value.email), email: value.email ? String(value.email).toLowerCase() : null, phone: value.phone || null, role: value.role || null, notes: value.notes || null, tags: Array.isArray(value.tags) ? value.tags : [], isPrimary: Boolean(value.isPrimary || value.isFavorite) };
      if (value.id) return (await database.update(contacts).set({ ...fields, updatedAt: new Date() }).where(and(eq(contacts.organizationId, organizationId), eq(contacts.id, value.id))).returning())[0];
      const existing = value.email ? (await database.select().from(contacts).where(and(eq(contacts.organizationId, organizationId), eq(contacts.email, String(value.email).toLowerCase()))).limit(1))[0] : null;
      if (existing) return (await database.update(contacts).set({ ...fields, updatedAt: new Date() }).where(eq(contacts.id, existing.id)).returning())[0];
      return (await database.insert(contacts).values({ id: randomUUID(), organizationId, ...fields }).returning())[0];
    },
    delete: async (organizationId: string, id: string) => (await database.delete(contacts).where(and(eq(contacts.organizationId, organizationId), eq(contacts.id, id))).returning()).length > 0,
  };
}
