import { NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';

export const runtime = 'nodejs';

/**
 * POST /api/test/recreate-generated-videos-table
 * 重新创建generated_videos表
 */
export async function POST() {
  try {
    const db = await getDb();

    // 1. 删除表（如果存在）
    try {
      await db.execute(`DROP TABLE IF EXISTS generated_videos CASCADE;`);
      console.log('[recreate-table] ✅ 表已删除');
    } catch (dropError) {
      console.warn('[recreate-table] ⚠️ 删除表失败（可能不存在）:', dropError);
    }

    // 2. 创建表（不带默认值，因为PostgreSQL中nullable字段默认就是NULL）
    await db.execute(`
      CREATE TABLE generated_videos (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        story_id VARCHAR(36) NOT NULL,
        scene_id VARCHAR(36) NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        url TEXT NOT NULL,
        storage_key TEXT NOT NULL,
        thumbnail_url TEXT,
        thumbnail_storage_key TEXT,
        duration INTEGER,
        mode VARCHAR(20) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );
    `);

    console.log('[recreate-table] ✅ 表创建成功');

    // 3. 创建索引
    await db.execute(`
      CREATE INDEX generated_videos_story_id_idx ON generated_videos USING btree (story_id ASC NULLS LAST);
    `);

    await db.execute(`
      CREATE INDEX generated_videos_scene_id_idx ON generated_videos USING btree (scene_id ASC NULLS LAST);
    `);

    console.log('[recreate-table] ✅ 索引创建成功');

    // 4. 添加外键约束
    try {
      await db.execute(`
        ALTER TABLE generated_videos
        ADD CONSTRAINT generated_videos_story_id_fkey
        FOREIGN KEY (story_id)
        REFERENCES stories(id)
        ON DELETE CASCADE;
      `);
      console.log('[recreate-table] ✅ 外键约束添加成功');
    } catch (fkError: any) {
      console.warn('[recreate-table] ⚠️ 添加外键约束失败（可能已存在）:', fkError.message);
    }

    return NextResponse.json({
      success: true,
      message: '表重新创建成功',
    });
  } catch (error) {
    console.error('[recreate-table] 重新创建表失败:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '重新创建表失败',
      },
      { status: 500 }
    );
  }
}
