import { NextRequest, NextResponse } from 'next/server';
import { storyManager } from '@/storage/database/storyManager';
import { stories } from '@/storage/database/shared/schema';
import { getDb } from 'coze-coding-dev-sdk';

export const runtime = 'nodejs';

/**
 * GET /api/stories
 * 获取所有故事（调试用）
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    const db = await getDb();
    const allStories = await db.select().from(stories);

    const result = userId
      ? allStories.filter((s: any) => s.userId === userId)
      : allStories;

    return NextResponse.json({
      success: true,
      data: result,
      total: result.length,
      message: '获取所有故事成功',
    });
  } catch (error) {
    console.error('获取所有故事失败:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return NextResponse.json(
      {
        success: false,
        message: `操作失败: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}
