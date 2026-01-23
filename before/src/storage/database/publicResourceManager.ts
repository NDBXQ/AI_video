import { and, asc, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { getDb } from 'coze-coding-dev-sdk';
import {
  insertPublicResourceSchema,
  publicResources,
  type InsertPublicResource,
  type PublicResource,
} from './shared/schema';

type ListPublicResourcesParams = {
  type?: 'all' | 'character' | 'background' | 'props' | 'music' | 'effect' | 'transition';
  search?: string;
  sort?: 'recent' | 'oldest' | 'title';
  limit?: number;
  offset?: number;
};

class PublicResourceManager {
  async createResource(payload: InsertPublicResource): Promise<PublicResource> {
    const db = await getDb();
    const safePayload = insertPublicResourceSchema.parse(payload);
    const [created] = await db.insert(publicResources).values(safePayload).returning();
    return created;
  }

  async listResources(params: ListPublicResourcesParams): Promise<{ items: PublicResource[]; total: number }> {
    const db = await getDb();
    const limit = typeof params.limit === 'number' ? Math.max(0, Math.min(100, params.limit)) : 60;
    const offset = typeof params.offset === 'number' ? Math.max(0, params.offset) : 0;

    const whereParts = [];
    const type = params.type || 'all';
    if (type !== 'all') whereParts.push(eq(publicResources.type, type));

    const keyword = (params.search || '').trim();
    if (keyword.length > 0) {
      const like = `%${keyword}%`;
      whereParts.push(
        or(
          ilike(publicResources.name, like),
          ilike(publicResources.description, like),
          sql`${publicResources.tags}::text ILIKE ${like}`
        )!
      );
    }

    const whereClause = whereParts.length > 0 ? and(...whereParts) : undefined;

    const countRows = await db
      .select({ count: sql<number>`count(*)` })
      .from(publicResources)
      .where(whereClause as any);
    const total = Number(countRows?.[0]?.count || 0);

    const sort = params.sort || 'recent';
    const rows =
      limit <= 0
        ? []
        : await db
            .select()
            .from(publicResources)
            .where(whereClause as any)
            .orderBy(
              sort === 'title'
                ? (sql`${publicResources.name} ASC NULLS LAST, ${publicResources.createdAt} DESC` as any)
                : sort === 'oldest'
                  ? asc(publicResources.createdAt)
                  : desc(publicResources.createdAt)
            )
            .limit(limit)
            .offset(offset);

    return { items: rows, total };
  }

  async deleteResources(ids: string[]): Promise<{ deletedCount: number }> {
    const db = await getDb();
    const uniqueIds = Array.from(new Set(ids.map((id) => String(id).trim()).filter(Boolean))).slice(0, 200);
    if (uniqueIds.length <= 0) return { deletedCount: 0 };
    const result = await db.delete(publicResources).where(inArray(publicResources.id, uniqueIds));
    return { deletedCount: result.rowCount ?? 0 };
  }
}

export const publicResourceManager = new PublicResourceManager();
