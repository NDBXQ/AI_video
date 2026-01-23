import { NextRequest, NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';

export const runtime = 'nodejs';

/**
 * POST /api/database/migrate-generated-videos
 * 执行数据库迁移，创建generated_videos表
 */
export async function POST(request: NextRequest) {
  try {
    const db = await getDb();

    // 检查generated_videos表是否存在
    const generatedVideosExists = await db.execute(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'generated_videos'
      );
    `);

    // 创建generated_videos表
    if (!generatedVideosExists.rows[0].exists) {
      await db.execute(`
        CREATE TABLE generated_videos (
          id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
          story_id VARCHAR(36) NOT NULL,
          scene_id VARCHAR(36) NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          url TEXT NOT NULL,
          storage_key TEXT NOT NULL,
          thumbnail_url TEXT DEFAULT NULL,
          thumbnail_storage_key TEXT DEFAULT NULL,
          duration INTEGER DEFAULT NULL,
          mode VARCHAR(20) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
        );
      `);

      console.log('[migrate-generated-videos] ✅ 表创建成功');

      // 创建索引
      await db.execute(`
        CREATE INDEX generated_videos_story_id_idx ON generated_videos USING btree (story_id ASC NULLS LAST);
      `);

      await db.execute(`
        CREATE INDEX generated_videos_scene_id_idx ON generated_videos USING btree (scene_id ASC NULLS LAST);
      `);

      console.log('[migrate-generated-videos] ✅ 索引创建成功');

      // 添加外键约束
      try {
        await db.execute(`
          ALTER TABLE generated_videos
          ADD CONSTRAINT generated_videos_story_id_fkey
          FOREIGN KEY (story_id)
          REFERENCES stories(id)
          ON DELETE CASCADE;
        `);
        console.log('[migrate-generated-videos] ✅ 外键约束添加成功');
      } catch (fkError: any) {
        console.warn('[migrate-generated-videos] ⚠️ 添加外键约束失败（可能已存在）:', fkError.message);
      }

      return NextResponse.json({
        success: true,
        message: '数据库迁移成功，已创建generated_videos表',
      });
    } else {
      console.log('[migrate-generated-videos] 表已存在，无需迁移');
      return NextResponse.json({
        success: true,
        message: 'generated_videos表已存在，无需迁移',
      });
    }
  } catch (error) {
    console.error('[migrate-generated-videos] 数据库迁移失败:', error);

    const errorMessage =
      error instanceof Error ? error.message : '未知错误';

    return NextResponse.json(
      {
        success: false,
        message: `迁移失败: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}
