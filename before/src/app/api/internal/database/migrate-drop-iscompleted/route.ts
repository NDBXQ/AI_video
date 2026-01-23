import { NextRequest, NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';

export const runtime = 'nodejs';

/**
 * POST /api/database/migrate-drop-iscompleted
 * 从数据库表中删除is_completed字段
 */
export async function POST(request: NextRequest) {
  try {
    const db = await getDb();

    // 检查storyboard_texts表的is_completed列是否存在
    const storyboardTextsColumnExists = await db.execute(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'storyboard_texts'
        AND column_name = 'is_completed'
      );
    `);

    // 检查storyboard_scripts表的is_completed列是否存在
    const storyboardScriptsColumnExists = await db.execute(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'storyboard_scripts'
        AND column_name = 'is_completed'
      );
    `);

    // 检查story_outlines表的is_completed列是否存在
    const storyOutlinesColumnExists = await db.execute(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'story_outlines'
        AND column_name = 'is_completed'
      );
    `);

    const results = [];

    // 删除storyboard_texts表的is_completed列
    if (storyboardTextsColumnExists.rows[0].exists) {
      try {
        await db.execute(`
          ALTER TABLE storyboard_texts DROP COLUMN IF EXISTS is_completed;
        `);
        results.push({
          table: 'storyboard_texts',
          action: 'DROP COLUMN is_completed',
          success: true
        });
      } catch (error: any) {
        results.push({
          table: 'storyboard_texts',
          action: 'DROP COLUMN is_completed',
          success: false,
          error: error.message
        });
      }
    } else {
      results.push({
        table: 'storyboard_texts',
        action: 'SKIP',
        reason: 'is_completed列不存在'
      });
    }

    // 删除storyboard_scripts表的is_completed列
    if (storyboardScriptsColumnExists.rows[0].exists) {
      try {
        await db.execute(`
          ALTER TABLE storyboard_scripts DROP COLUMN IF EXISTS is_completed;
        `);
        results.push({
          table: 'storyboard_scripts',
          action: 'DROP COLUMN is_completed',
          success: true
        });
      } catch (error: any) {
        results.push({
          table: 'storyboard_scripts',
          action: 'DROP COLUMN is_completed',
          success: false,
          error: error.message
        });
      }
    } else {
      results.push({
        table: 'storyboard_scripts',
        action: 'SKIP',
        reason: 'is_completed列不存在'
      });
    }

    // 删除story_outlines表的is_completed列
    if (storyOutlinesColumnExists.rows[0].exists) {
      try {
        await db.execute(`
          ALTER TABLE story_outlines DROP COLUMN IF EXISTS is_completed;
        `);
        results.push({
          table: 'story_outlines',
          action: 'DROP COLUMN is_completed',
          success: true
        });
      } catch (error: any) {
        results.push({
          table: 'story_outlines',
          action: 'DROP COLUMN is_completed',
          success: false,
          error: error.message
        });
      }
    } else {
      results.push({
        table: 'story_outlines',
        action: 'SKIP',
        reason: 'is_completed列不存在'
      });
    }

    return NextResponse.json({
      success: true,
      message: '数据库迁移成功，已删除is_completed字段',
      results
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
