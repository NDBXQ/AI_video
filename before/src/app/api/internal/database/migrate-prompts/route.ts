import { NextRequest, NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';

export const runtime = 'nodejs';

/**
 * POST /api/database/migrate-prompts
 * 执行数据库迁移，创建prompts表
 */
export async function POST(request: NextRequest) {
  try {
    const db = await getDb();

    // 检查prompts表是否存在
    const promptsExists = await db.execute(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'prompts'
      );
    `);

    // 创建prompts表
    if (!promptsExists.rows[0].exists) {
      console.log('[migrate-prompts] 开始创建prompts表...');

      await db.execute(`
        CREATE TABLE prompts (
          id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
          scene_id VARCHAR(36) NOT NULL,
          video_prompt TEXT,
          image_prompt_type VARCHAR(50),
          image_prompt TEXT,
          run_id TEXT,
          script_json TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE
        );
      `);

      console.log('[migrate-prompts] prompts表创建成功');

      // 创建索引
      await db.execute(`
        CREATE INDEX prompts_scene_id_idx ON prompts USING btree (scene_id ASC NULLS LAST);
      `);

      console.log('[migrate-prompts] 索引创建成功');

      return NextResponse.json({
        success: true,
        message: '数据库迁移成功，已创建prompts表',
      });
    } else {
      return NextResponse.json({
        success: true,
        message: 'prompts表已存在，无需迁移',
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
