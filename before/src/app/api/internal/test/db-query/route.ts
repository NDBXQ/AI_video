import { NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';
import { storyOutlines, storyboardTexts, storyboardScripts } from '@/storage/database/shared/schema';

/**
 * 测试数据库查询API
 */
export async function GET() {
  try {
    const db = await getDb();

    // 查询story_outlines表
    const outlines = await db.select().from(storyOutlines).limit(5);
    console.log('story_outlines 表数据:', outlines.length);

    // 查询storyboard_texts表
    const texts = await db.select().from(storyboardTexts).limit(5);
    console.log('storyboard_texts 表数据:', texts.length);

    // 查询storyboard_scripts表
    const scripts = await db.select().from(storyboardScripts).limit(5);
    console.log('storyboard_scripts 表数据:', scripts.length);

    return NextResponse.json({
      success: true,
      data: {
        storyOutlinesCount: outlines.length,
        storyboardTextsCount: texts.length,
        storyboardScriptsCount: scripts.length,
        storyOutlinesSample: outlines,
        storyboardTextsSample: texts,
        storyboardScriptsSample: scripts,
      },
    });
  } catch (error) {
    console.error('数据库查询失败:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '未知错误',
        error: String(error)
      },
      { status: 500 }
    );
  }
}
