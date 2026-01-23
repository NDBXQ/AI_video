import { NextRequest, NextResponse } from 'next/server';
import { promptManager } from '@/storage/database/promptManager';

/**
 * 查询视频提示词（测试用）
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sceneId = searchParams.get('sceneId');

    console.log('[test-video-prompts] 收到查询请求:', { sceneId });

    if (sceneId) {
      // 根据sceneId查询
      const prompt = await promptManager.getPromptByStoryboardId(sceneId);
      return NextResponse.json({
        success: true,
        data: prompt,
      });
    } else {
      // 返回所有提示词（需要实现getAll方法）
      return NextResponse.json({
        success: false,
        message: '请提供sceneId参数',
      }, { status: 400 });
    }
  } catch (error) {
    console.error('[test-video-prompts] 查询失败:', error);
    return NextResponse.json({
      success: false,
      message: `查询失败: ${error instanceof Error ? error.message : '未知错误'}`,
    }, { status: 500 });
  }
}
