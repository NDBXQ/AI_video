import { NextRequest, NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const db = await getDb();

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
          message: 'storyboard_texts表不存在，请先执行基础迁移',
        },
        { status: 400 }
      );
    }

    const videoFlagExists = await db.execute(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'storyboard_texts'
          AND column_name = 'is_video_generated'
      );
    `);

    if (!videoFlagExists.rows[0].exists) {
      await db.execute(`
        ALTER TABLE storyboard_texts
        ADD COLUMN is_video_generated BOOLEAN DEFAULT false NOT NULL;
      `);
    }

    const scriptFlagExists = await db.execute(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'storyboard_texts'
          AND column_name = 'is_script_generated'
      );
    `);

    if (!scriptFlagExists.rows[0].exists) {
      await db.execute(`
        ALTER TABLE storyboard_texts
        ADD COLUMN is_script_generated BOOLEAN DEFAULT false NOT NULL;
      `);
    }

    await db.execute(`
      UPDATE storyboard_texts st
      SET is_script_generated = true
      WHERE EXISTS (
        SELECT 1
        FROM storyboard_scripts ss
        WHERE ss.storyboard_text_id = st.id
      );
    `);

    await db.execute(`
      UPDATE storyboard_texts st
      SET is_video_generated = true
      WHERE EXISTS (
        SELECT 1
        FROM generated_videos gv
        WHERE gv.storyboard_id = st.id
      );
    `);

    return NextResponse.json({
      success: true,
      message: '数据库迁移成功，已添加并回填 is_video_generated / is_script_generated',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return NextResponse.json(
      {
        success: false,
        message: `迁移失败: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}

