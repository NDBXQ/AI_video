import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { getDb } from 'coze-coding-dev-sdk';
import { insertLibraryAssetSchema, libraryAssets, type InsertLibraryAsset, type LibraryAsset } from './shared/schema';

type ListLibraryAssetsParams = {
  type: 'image' | 'video' | 'audio';
  search?: string;
  sort?: 'recent' | 'oldest' | 'title';
  limit?: number;
  offset?: number;
};

class LibraryAssetManager {
  async createAsset(payload: InsertLibraryAsset): Promise<LibraryAsset> {
    const db = await getDb();
    const safePayload = insertLibraryAssetSchema.parse(payload);
    const [created] = await db.insert(libraryAssets).values(safePayload).returning();
    return created;
  }

  async listAssets(params: ListLibraryAssetsParams): Promise<{ items: LibraryAsset[]; total: number }> {
    const db = await getDb();
    const limit = typeof params.limit === 'number' ? Math.max(0, Math.min(100, params.limit)) : 60;
    const offset = typeof params.offset === 'number' ? Math.max(0, params.offset) : 0;

    const whereParts = [eq(libraryAssets.type, params.type)];

    const keyword = (params.search || '').trim();
    if (keyword.length > 0) {
      const like = `%${keyword}%`;
      whereParts.push(
        or(
          ilike(libraryAssets.title, like),
          ilike(libraryAssets.prompt, like),
          sql`${libraryAssets.tags}::text ILIKE ${like}`
        )!
      );
    }

    const sort = params.sort || 'recent';
    const countRows = await db
      .select({ count: sql<number>`count(*)` })
      .from(libraryAssets)
      .where(and(...whereParts));
    const total = Number(countRows?.[0]?.count || 0);

    const rows =
      limit <= 0
        ? []
        : await db
      .select()
      .from(libraryAssets)
      .where(and(...whereParts))
      .orderBy(
        sort === 'title'
          ? (sql`${libraryAssets.title} ASC NULLS LAST, ${libraryAssets.createdAt} DESC` as any)
          : sort === 'oldest'
            ? asc(libraryAssets.createdAt)
            : desc(libraryAssets.createdAt)
      )
      .limit(limit)
      .offset(offset);

    return { items: rows, total };
  }
}

export const libraryAssetManager = new LibraryAssetManager();
