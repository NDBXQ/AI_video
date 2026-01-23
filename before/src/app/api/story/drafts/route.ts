import { NextRequest, NextResponse } from 'next/server';
import { storyManager } from '@/storage/database/storyManager';

export const runtime = 'nodejs';

/**
 * GET /api/story/drafts
 * 获取用户的所有草稿作品
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    // 验证必填参数
    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          message: '缺少必填参数：userId',
        },
        { status: 400 }
      );
    }

    // 获取草稿作品
    const drafts = await storyManager.getDraftsByUserId(userId);

    return NextResponse.json({
      success: true,
      data: drafts,
      message: '获取草稿作品成功',
    });
  } catch (error) {
    console.error('获取草稿作品失败:', error);
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
