import { NextRequest, NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';

export const runtime = 'nodejs';

/**
 * POST /api/database/add-foreign-keys
 * 添加外键约束
 */
export async function POST(request: NextRequest) {
  try {
    const db = await getDb();

    let message = '';
    const errors: string[] = [];

    // 尝试添加storyboard_texts的外键约束
    try {
      await db.execute(`
        ALTER TABLE storyboard_texts
        ADD CONSTRAINT storyboard_texts_outline_id_fkey
        FOREIGN KEY (outline_id)
        REFERENCES story_outlines(id)
        ON DELETE CASCADE;
      `);
      message += '已添加storyboard_texts外键约束；';
    } catch (error: any) {
      console.error('添加storyboard_texts外键约束失败:', error);
      errors.push(`storyboard_texts外键: ${error.message}`);
    }

    // 尝试添加storyboard_scripts的外键约束
    try {
      await db.execute(`
        ALTER TABLE storyboard_scripts
        ADD CONSTRAINT storyboard_scripts_text_id_fkey
        FOREIGN KEY (storyboard_text_id)
        REFERENCES storyboard_texts(id)
        ON DELETE CASCADE;
      `);
      message += '已添加storyboard_scripts外键约束；';
    } catch (error: any) {
      console.error('添加storyboard_scripts外键约束失败:', error);
      errors.push(`storyboard_scripts外键: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: message || '操作完成',
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('添加外键约束失败:', error);

    const errorMessage =
      error instanceof Error ? error.message : '未知错误';

    return NextResponse.json(
      {
        success: false,
        message: `失败: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}
