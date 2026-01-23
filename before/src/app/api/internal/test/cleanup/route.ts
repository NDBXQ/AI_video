import { NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';
import { eq } from 'drizzle-orm';
import { storyboardTexts } from '@/storage/database/shared/schema';

/**
 * 清理测试数据
 */
export async function POST() {
  try {
    const db = await getDb();
    await db.delete(storyboardTexts).where(eq(storyboardTexts.sceneTitle, '测试场景'));

    return NextResponse.json({
      success: true,
      message: '测试数据已清理'
    });
  } catch (error) {
    console.error('清理测试数据失败:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    );
  }
}
