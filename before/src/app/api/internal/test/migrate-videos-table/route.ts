import { NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';
import { sql } from 'drizzle-orm';

export const runtime = 'nodejs';

/**
 * POST /api/test/migrate-videos-table
 * 迁移generated_videos表，为可选字段添加默认值
 */
export async function POST() {
  try {
    console.log('[migrate-videos-table] 开始迁移generated_videos表...');

    const db = await getDb();

    // 1. 检查表是否存在
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'generated_videos'
      );
    `);

    if (!tableExists.rows[0].exists) {
      return NextResponse.json(
        {
          success: false,
          message: 'generated_videos表不存在',
        },
        { status: 404 }
      );
    }

    console.log('[migrate-videos-table] 表存在，开始添加默认值...');

    // 2. 为thumbnail_url字段添加默认值NULL
    await db.execute(sql`
      ALTER TABLE generated_videos
      ALTER COLUMN thumbnail_url SET DEFAULT NULL;
    `);
    console.log('[migrate-videos-table] ✅ thumbnail_url字段默认值已设置');

    // 3. 为thumbnail_storage_key字段添加默认值NULL
    await db.execute(sql`
      ALTER TABLE generated_videos
      ALTER COLUMN thumbnail_storage_key SET DEFAULT NULL;
    `);
    console.log('[migrate-videos-table] ✅ thumbnail_storage_key字段默认值已设置');

    // 4. 为duration字段添加默认值NULL
    await db.execute(sql`
      ALTER TABLE generated_videos
      ALTER COLUMN duration SET DEFAULT NULL;
    `);
    console.log('[migrate-videos-table] ✅ duration字段默认值已设置');

    console.log('[migrate-videos-table] ✅ 迁移完成');

    return NextResponse.json({
      success: true,
      message: '迁移成功',
    });
  } catch (error) {
    console.error('[migrate-videos-table] 迁移失败:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '迁移失败',
      },
      { status: 500 }
    );
  }
}
