import { NextRequest, NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';
import { sql } from 'drizzle-orm';

export const runtime = 'nodejs';

/**
 * GET /api/test/describe-table
 * 查看表结构
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tableName = searchParams.get('table');

    if (!tableName) {
      return NextResponse.json(
        {
          success: false,
          message: '请提供table参数',
        },
        { status: 400 }
      );
    }

    const db = await getDb();

    const result = await db.execute(sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = ${tableName}
      AND table_schema = 'public'
      ORDER BY ordinal_position;
    `);

    console.log(`[describe-table] 表 ${tableName} 的结构:`, result.rows);

    return NextResponse.json({
      success: true,
      data: {
        table: tableName,
        columns: result.rows,
      },
    });
  } catch (error) {
    console.error('[describe-table] 查询失败:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '查询失败',
      },
      { status: 500 }
    );
  }
}
