import { NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';

export const runtime = 'nodejs';

/**
 * POST /api/test/fix-generated-videos-table
 * 修改表，将可选字段改为非空并设置默认值
 */
export async function POST() {
  try {
    const db = await getDb();

    // 1. 删除表
    await db.execute(`DROP TABLE IF EXISTS generated_videos CASCADE;`);
    console.log('[fix-table] 表已删除');

    // 2. 重新创建表（可选字段改为非空，默认值为空字符串）
    await db.execute(`
      CREATE TABLE generated_videos (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        story_id VARCHAR(36) NOT NULL,
        scene_id VARCHAR(36) NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        url TEXT NOT NULL,
        storage_key TEXT NOT NULL,
        thumbnail_url TEXT NOT NULL DEFAULT '',
        thumbnail_storage_key TEXT NOT NULL DEFAULT '',
        duration INTEGER NOT NULL DEFAULT 0,
        mode VARCHAR(20) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );
    `);

    console.log('[fix-table] 表创建成功');

    // 3. 创建索引
    await db.execute(`
      CREATE INDEX generated_videos_story_id_idx ON generated_videos USING btree (story_id ASC NULLS LAST);
    `);

    await db.execute(`
      CREATE INDEX generated_videos_scene_id_idx ON generated_videos USING btree (scene_id ASC NULLS LAST);
    `);

    console.log('[fix-table] 索引创建成功');

    // 4. 添加外键约束
    try {
      await db.execute(`
        ALTER TABLE generated_videos
        ADD CONSTRAINT generated_videos_story_id_fkey
        FOREIGN KEY (story_id)
        REFERENCES stories(id)
        ON DELETE CASCADE;
      `);
      console.log('[fix-table] 外键约束添加成功');
    } catch (fkError: any) {
      console.warn('[fix-table] 添加外键约束失败（可能已存在）:', fkError.message);
    }

    return NextResponse.json({
      success: true,
      message: '表修复成功',
    });
  } catch (error) {
    console.error('[fix-table] 修复表失败:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '修复表失败',
      },
      { status: 500 }
    );
  }
}
