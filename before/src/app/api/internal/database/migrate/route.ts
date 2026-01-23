import { NextRequest, NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';

export const runtime = 'nodejs';

/**
 * POST /api/database/migrate
 * 执行数据库迁移，创建storyboard_texts和storyboard_scripts表
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

    // 检查storyboard_scripts表是否存在
    const storyboardScriptsExists = await db.execute(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'storyboard_scripts'
      );
    `);

    // 创建storyboard_texts表
    if (!storyboardTextsExists.rows[0].exists) {
      await db.execute(`
        CREATE TABLE storyboard_texts (
          id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
          outline_id VARCHAR(36) NOT NULL,
          sequence INTEGER NOT NULL,
          scene_title TEXT NOT NULL,
          original_text TEXT NOT NULL,
          storyboard_text TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE
        );
      `);

      // 创建索引
      await db.execute(`
        CREATE INDEX storyboard_texts_outline_id_idx ON storyboard_texts USING btree (outline_id ASC NULLS LAST);
      `);

      // 添加外键约束
      try {
        await db.execute(`
          ALTER TABLE storyboard_texts
          ADD CONSTRAINT storyboard_texts_outline_id_fkey
          FOREIGN KEY (outline_id)
          REFERENCES story_outlines(id)
          ON DELETE CASCADE;
        `);
      } catch (fkError: any) {
        console.warn('添加外键约束失败（可能已存在）:', fkError.message);
      }
    }

    // 创建storyboard_scripts表
    if (!storyboardScriptsExists.rows[0].exists) {
      await db.execute(`
        CREATE TABLE storyboard_scripts (
          id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
          storyboard_text_id VARCHAR(36) NOT NULL,
          sequence INTEGER NOT NULL,
          script_content TEXT NOT NULL,
          image_url TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE
        );
      `);

      // 创建索引
      await db.execute(`
        CREATE INDEX storyboard_scripts_text_id_idx ON storyboard_scripts USING btree (storyboard_text_id ASC NULLS LAST);
      `);

      // 添加外键约束
      try {
        await db.execute(`
          ALTER TABLE storyboard_scripts
          ADD CONSTRAINT storyboard_scripts_text_id_fkey
          FOREIGN KEY (storyboard_text_id)
          REFERENCES storyboard_texts(id)
          ON DELETE CASCADE;
        `);
      } catch (fkError: any) {
        console.warn('添加外键约束失败（可能已存在）:', fkError.message);
      }
    }

    return NextResponse.json({
      success: true,
      message: '数据库迁移成功，已创建storyboard_texts和storyboard_scripts表',
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
