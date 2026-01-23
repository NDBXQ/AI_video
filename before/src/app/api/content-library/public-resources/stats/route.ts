import { NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';
import { sql } from 'drizzle-orm';
import { publicResources } from '@/storage/database';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const db = await getDb();
    const rows = await db
      .select({
        type: publicResources.type,
        count: sql<number>`count(*)`,
      })
      .from(publicResources)
      .groupBy(publicResources.type);

    const counts = {
      all: 0,
      character: 0,
      background: 0,
      props: 0,
      music: 0,
      effect: 0,
      transition: 0,
    };

    for (const row of rows as any[]) {
      const key = String(row.type) as keyof typeof counts;
      const n = Number(row.count || 0);
      if (key in counts) counts[key] = n;
      counts.all += n;
    }

    return NextResponse.json({ success: true, data: counts });
  } catch (error) {
    console.error('[content-library/public-resources/stats] GET failed:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

