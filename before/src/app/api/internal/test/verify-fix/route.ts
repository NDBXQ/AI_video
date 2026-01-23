import { NextRequest, NextResponse } from 'next/server';
import { storyboardTextManager } from '@/storage/database/storyboardTextManager';

/**
 * 验证修复效果
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { outlineId, sequence } = body;

    console.log('验证修复:', { outlineId, sequence });

    if (!outlineId || sequence === undefined) {
      return NextResponse.json(
        { success: false, message: '缺少必填参数' },
        { status: 400 }
      );
    }

    // 尝试创建分镜文本
    const result = await storyboardTextManager.createStoryboardText({
      outlineId,
      sequence,
      sceneTitle: '验证测试场景',
      originalText: '验证测试原文',
      shotCut: false,
      storyboardText: '验证测试分镜文本',
    });

    console.log('✅ 修复验证成功，数据已保存:', result.id);

    return NextResponse.json({
      success: true,
      data: result,
      message: '修复验证成功'
    });
  } catch (error) {
    console.error('❌ 修复验证失败:', error);
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
