import { NextRequest, NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';

export const runtime = 'nodejs';

/**
 * POST /api/database/migrate-generated-images
 * 执行数据库迁移，创建generated_images表
 */
export async function POST(request: NextRequest) {
  try {
    const db = await getDb();

    // 检查generated_images表是否存在
    const generatedImagesExists = await db.execute(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'generated_images'
      );
    `);

    // 创建generated_images表
    if (!generatedImagesExists.rows[0].exists) {
      await db.execute(`
        CREATE TABLE generated_images (
          id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
          story_id VARCHAR(36) NOT NULL,
          scene_id VARCHAR(36) NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          url TEXT NOT NULL,
          storage_key TEXT NOT NULL,
          category VARCHAR(20) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
        );
      `);

      // 创建索引
      await db.execute(`
        CREATE INDEX generated_images_story_id_idx ON generated_images USING btree (story_id ASC NULLS LAST);
      `);

      await db.execute(`
        CREATE INDEX generated_images_scene_id_idx ON generated_images USING btree (scene_id ASC NULLS LAST);
      `);

      // 添加外键约束
      try {
        await db.execute(`
          ALTER TABLE generated_images
          ADD CONSTRAINT generated_images_story_id_fkey
          FOREIGN KEY (story_id)
          REFERENCES stories(id)
          ON DELETE CASCADE;
        `);
      } catch (fkError: any) {
        console.warn('添加外键约束失败（可能已存在）:', fkError.message);
      }

      return NextResponse.json({
        success: true,
        message: '数据库迁移成功，已创建generated_images表',
      });
    } else {
      return NextResponse.json({
        success: true,
        message: 'generated_images表已存在，无需迁移',
      });
    }
  } catch (error) {
    console.error('数据库迁移失败:', error);

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
