import { NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';
import { sql } from 'drizzle-orm';

export const runtime = 'nodejs';

/**
 * GET /api/test/list-tables
 * 列出数据库中所有表
 */
export async function GET() {
  try {
    const db = await getDb();

    const result = await db.execute(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    const tables = result.rows.map((row: any) => row.table_name);

    console.log('[list-tables] 数据库中的表:', tables);

    return NextResponse.json({
      success: true,
      data: {
        tables,
      },
    });
  } catch (error) {
    console.error('[list-tables] 查询失败:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '查询失败',
      },
      { status: 500 }
    );
  }
}
