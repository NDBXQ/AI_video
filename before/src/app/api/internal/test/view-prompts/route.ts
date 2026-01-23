import { NextRequest, NextResponse } from 'next/server';
import { promptManager } from '@/storage/database/promptManager';

export const runtime = 'nodejs';

/**
 * GET /api/test/view-prompts
 * 查看所有提示词记录
 */
export async function GET(request: NextRequest) {
  try {
    // 暂时通过查询特定sceneId来查看
    const { searchParams } = new URL(request.url);
    const sceneId = searchParams.get('sceneId');

    if (sceneId) {
      const prompt = await promptManager.getPromptByStoryboardId(sceneId);
      return NextResponse.json({
        success: true,
        data: prompt,
      });
    }

    return NextResponse.json({
      success: false,
      message: '请提供sceneId参数',
    });
  } catch (error) {
    console.error('查询提示词失败:', error);
    return NextResponse.json(
      {
        success: false,
        message: `查询失败: ${error instanceof Error ? error.message : '未知错误'}`,
      },
      { status: 500 }
    );
  }
}
