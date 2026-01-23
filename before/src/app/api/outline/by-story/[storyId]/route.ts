import { NextRequest, NextResponse } from 'next/server';
import { storyOutlineManager } from '@/storage/database/storyOutlineManager';

export const runtime = 'nodejs';

/**
 * POST /api/outline/create
 * 批量创建故事大纲
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { storyId, outlines } = body;

    // 验证必填参数
    if (!storyId || !Array.isArray(outlines)) {
      return NextResponse.json(
        {
          success: false,
          message: '缺少必填参数：storyId, outlines',
        },
        { status: 400 }
      );
    }

    // 批量创建大纲
    const createdOutlines = await storyOutlineManager.createOutlines(
      outlines.map((item: any, index: number) => ({
        storyId,
        sequence: index + 1,
        outlineText: item.outline || item.outlineText,
        originalText: item.original || item.originalText,
      }))
    );

    return NextResponse.json({
      success: true,
      data: createdOutlines,
      message: '故事大纲创建成功',
    });
  } catch (error) {
    console.error('创建故事大纲失败:', error);
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

/**
 * GET /api/outline/by-story/[storyId]
 * 获取故事的所有大纲
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storyId: string }> }
) {
  try {
    const { storyId } = await params;

    const outlines = await storyOutlineManager.getOutlinesByStoryId(storyId);

    return NextResponse.json({
      success: true,
      data: outlines,
      message: '获取成功',
    });
  } catch (error) {
    console.error('获取故事大纲失败:', error);
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

/**
 * DELETE /api/outline/by-story/[storyId]
 * 删除故事的所有大纲
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ storyId: string }> }
) {
  try {
    const { storyId } = await params;

    await storyOutlineManager.deleteOutlinesByStoryId(storyId);

    return NextResponse.json({
      success: true,
      message: '删除成功',
    });
  } catch (error) {
    console.error('删除故事大纲失败:', error);
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
