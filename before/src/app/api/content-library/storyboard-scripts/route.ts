import { NextRequest, NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';
import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { storyboardScripts, storyboardTexts } from '@/storage/database';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get('search') || '').trim();
    const sort = (searchParams.get('sort') || 'recent') as 'recent' | 'oldest' | 'title';
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 60;
    const offset = searchParams.get('offset') ? Number(searchParams.get('offset')) : 0;

    if (!['recent', 'oldest', 'title'].includes(sort)) {
      return NextResponse.json({ success: false, message: 'sort 参数无效' }, { status: 400 });
    }

    const safeLimit = Math.max(0, Math.min(100, Number.isFinite(limit) ? limit : 60));
    const safeOffset = Math.max(0, Number.isFinite(offset) ? offset : 0);

    const db = await getDb();

    const whereParts = [];
    if (search.length > 0) {
      const like = `%${search}%`;
      whereParts.push(or(ilike(storyboardTexts.sceneTitle, like), ilike(storyboardScripts.scriptContent, like))!);
    }
    const whereClause = whereParts.length > 0 ? and(...whereParts) : undefined;

    const countRows = await db
      .select({ count: sql<number>`count(*)` })
      .from(storyboardScripts)
      .leftJoin(storyboardTexts, eq(storyboardScripts.storyboardTextId, storyboardTexts.id))
      .where(whereClause as any);
    const total = Number(countRows?.[0]?.count || 0);

    const rawRows =
      safeLimit <= 0
        ? []
        : await db
            .select({
              id: storyboardScripts.id,
              storyboardTextId: storyboardScripts.storyboardTextId,
              sequence: storyboardScripts.sequence,
              scriptContent: storyboardScripts.scriptContent,
              imageUrl: storyboardScripts.imageUrl,
              createdAt: storyboardScripts.createdAt,
              updatedAt: storyboardScripts.updatedAt,
              sceneTitle: storyboardTexts.sceneTitle,
            })
            .from(storyboardScripts)
            .leftJoin(storyboardTexts, eq(storyboardScripts.storyboardTextId, storyboardTexts.id))
            .where(whereClause as any)
            .orderBy(
              sort === 'title'
                ? (sql`${storyboardTexts.sceneTitle} ASC NULLS LAST, ${storyboardScripts.createdAt} DESC` as any)
                : sort === 'oldest'
                  ? asc(storyboardScripts.createdAt)
                  : desc(storyboardScripts.createdAt)
            )
            .limit(safeLimit)
            .offset(safeOffset);

    const rows = rawRows.map((row: any) => {
      const content = row.scriptContent;
      return {
        ...row,
        sceneTitle:
          typeof row.sceneTitle === 'string'
            ? row.sceneTitle
            : row.sceneTitle != null
              ? String(row.sceneTitle)
              : null,
        scriptContent:
          typeof content === 'string'
            ? content
            : content != null
              ? (() => {
                  try {
                    return JSON.stringify(content);
                  } catch {
                    return String(content);
                  }
                })()
              : '',
      };
    });

    return NextResponse.json({ success: true, data: rows, total });
  } catch (error) {
    console.error('[content-library/storyboard-scripts] GET failed:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
