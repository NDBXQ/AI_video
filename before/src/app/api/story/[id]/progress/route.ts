import { NextRequest, NextResponse } from 'next/server';
import { storyManager } from '@/storage/database/storyManager';

export const runtime = 'nodejs';

/**
 * POST /api/story/[id]/progress
 * 更新故事的进度阶段
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { progressStage } = body;

    // 验证必填参数
    if (!progressStage) {
      return NextResponse.json(
        {
          success: false,
          message: '缺少必填参数：progressStage',
        },
        { status: 400 }
      );
    }

    // 验证进度阶段值
    const validStages = ['outline', 'text', 'script', 'completed'];
    if (!validStages.includes(progressStage)) {
      return NextResponse.json(
        {
          success: false,
          message: `无效的进度阶段，必须是：${validStages.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // 更新进度阶段
    const story = await storyManager.updateProgressStage(
      id,
      progressStage as 'outline' | 'text' | 'script' | 'completed'
    );

    if (!story) {
      return NextResponse.json(
        {
          success: false,
          message: '故事不存在',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: story,
      message: '进度更新成功',
    });
  } catch (error) {
    console.error('更新进度失败:', error);
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
