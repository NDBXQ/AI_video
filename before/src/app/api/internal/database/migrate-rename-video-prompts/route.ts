import { NextRequest, NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';

export const runtime = 'nodejs';

/**
 * POST /api/database/migrate-rename-video-prompts
 * 将video_prompts表重命名为prompts（如果存在）
 */
export async function POST(request: NextRequest) {
  try {
    const db = await getDb();

    // 检查video_prompts表是否存在
    const videoPromptsExists = await db.execute(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'video_prompts'
      );
    `);

    const exists = videoPromptsExists.rows[0].exists;

    if (!exists) {
      console.log('[migrate-rename-video-prompts] video_prompts表不存在，无需操作');
      return NextResponse.json({
        success: true,
        message: 'video_prompts表不存在，无需重命名',
      });
    }

    console.log('[migrate-rename-video-prompts] 检测到video_prompts表，开始重命名...');

    // 检查prompts表是否已存在
    const promptsExists = await db.execute(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'prompts'
      );
    `);

    if (promptsExists.rows[0].exists) {
      // 如果两个表都存在，删除video_prompts表
      console.log('[migrate-rename-video-prompts] prompts表已存在，删除video_prompts表');

      await db.execute(`
        DROP TABLE IF EXISTS video_prompts;
      `);

      console.log('[migrate-rename-video-prompts] video_prompts表已删除');
    } else {
      // 重命名表
      console.log('[migrate-rename-video-prompts] 重命名video_prompts为prompts');

      await db.execute(`
        ALTER TABLE video_prompts RENAME TO prompts;
      `);

      console.log('[migrate-rename-video-prompts] 表重命名成功');
    }

    return NextResponse.json({
      success: true,
      message: '数据库迁移成功，video_prompts表已处理',
    });
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
