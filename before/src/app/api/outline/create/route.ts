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
