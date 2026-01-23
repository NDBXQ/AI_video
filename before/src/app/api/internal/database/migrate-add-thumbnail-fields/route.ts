import { NextRequest, NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const db = await getDb();

    console.log('[migrate-add-thumbnail-fields] 开始迁移...');

    // 检查列是否已存在
    const checkColumn = await db.execute(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'generated_images'
      AND column_name = 'thumbnail_url'
    `);

    if (checkColumn.rows && checkColumn.rows.length > 0) {
      console.log('[migrate-add-thumbnail-fields] 缩略图字段已存在，跳过迁移');
      return NextResponse.json({
        success: true,
        message: '缩略图字段已存在，无需迁移',
      });
    }

    // 添加缩略图相关字段
    await db.execute(`
      ALTER TABLE generated_images
      ADD COLUMN thumbnail_url TEXT,
      ADD COLUMN thumbnail_storage_key TEXT
    `);

    console.log('[migrate-add-thumbnail-fields] 迁移成功');

    return NextResponse.json({
      success: true,
      message: '成功添加缩略图字段',
    });
  } catch (error) {
    console.error('[migrate-add-thumbnail-fields] 迁移失败:', error);
    return NextResponse.json(
      {
        success: false,
        message: `迁移失败: ${error instanceof Error ? error.message : '未知错误'}`,
      },
      { status: 500 }
    );
  }
}
