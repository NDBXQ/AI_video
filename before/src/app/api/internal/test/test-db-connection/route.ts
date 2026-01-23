import { NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';
import { sql } from 'drizzle-orm';

export const runtime = 'nodejs';

/**
 * GET /api/test/test-db-connection
 * 测试数据库连接
 */
export async function GET() {
  try {
    const db = await getDb();

    // 测试SELECT语句
    const result = await db.execute(
      sql`SELECT COUNT(*) as count FROM stories;`
    );

    console.log('[test-db-connection] SELECT成功，result:', result.rows);

    return NextResponse.json({
      success: true,
      data: {
        count: result.rows[0].count,
      },
    });
  } catch (error) {
    console.error('[test-db-connection] 查询失败:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '查询失败',
      },
      { status: 500 }
    );
  }
}
