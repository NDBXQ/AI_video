import { NextRequest, NextResponse } from 'next/server';
import { storyboardTextManager } from '@/storage/database/storyboardTextManager';

/**
 * 测试数据库插入API
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { outlineId, sequence } = body;

    console.log('测试数据库插入:', { outlineId, sequence });

    if (!outlineId || sequence === undefined) {
      return NextResponse.json(
        { success: false, message: '缺少必填参数' },
        { status: 400 }
      );
    }

    const result = await storyboardTextManager.createStoryboardText({
      outlineId,
      sequence,
      sceneTitle: '测试场景',
      originalText: '测试原文',
      shotCut: false,
      storyboardText: '测试分镜文本',
    });

    console.log('插入成功:', result);

    return NextResponse.json({
      success: true,
      data: result,
      message: '插入成功'
    });
  } catch (error) {
    console.error('数据库插入测试失败:', error);
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
