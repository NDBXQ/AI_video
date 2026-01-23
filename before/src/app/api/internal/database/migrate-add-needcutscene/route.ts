import { NextRequest, NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';

export const runtime = 'nodejs';

/**
 * POST /api/database/migrate-add-needcutscene
 * 执行数据库迁移，为storyboard_texts表添加need_cut_scene字段
 */
export async function POST(request: NextRequest) {
  try {
    const db = await getDb();

    // 检查storyboard_texts表是否存在
    const storyboardTextsExists = await db.execute(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'storyboard_texts'
      );
    `);

    if (!storyboardTextsExists.rows[0].exists) {
      return NextResponse.json(
        {
          success: false,
          message: 'storyboard_texts表不存在，请先执行基础迁移'
        },
        { status: 400 }
      );
    }

    // 检查need_cut_scene列是否已存在
    const columnExists = await db.execute(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'storyboard_texts'
        AND column_name = 'need_cut_scene'
      );
    `);

    if (columnExists.rows[0].exists) {
      console.log('need_cut_scene字段已存在，跳过添加');
      return NextResponse.json({
        success: true,
        message: 'need_cut_scene字段已存在，无需迁移',
      });
    }

    // 添加need_cut_scene字段
    await db.execute(`
      ALTER TABLE storyboard_texts
      ADD COLUMN need_cut_scene BOOLEAN DEFAULT false NOT NULL;
    `);

    console.log('✅ 成功添加need_cut_scene字段到storyboard_texts表');

    return NextResponse.json({
      success: true,
      message: '数据库迁移成功，已为storyboard_texts表添加need_cut_scene字段',
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
