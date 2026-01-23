import { NextRequest, NextResponse } from 'next/server';
import { promptManager } from '@/storage/database/promptManager';

/**
 * 测试保存视频提示词到数据库
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sceneId, videoPrompt, imagePromptType, imagePrompt, runId, scriptJson } = body;

    console.log('[test-save-prompt] 收到保存请求:', { sceneId, runId });

    if (!sceneId) {
      return NextResponse.json({
        success: false,
        message: 'sceneId 是必填字段',
      }, { status: 400 });
    }

    const prompt = await promptManager.createPrompt({
      storyboardId: sceneId,
      videoPrompt: videoPrompt || null,
      imagePromptType: imagePromptType || null,
      imagePrompt: imagePrompt || null,
      runId: runId || null,
      scriptJson: scriptJson || null,
    });

    console.log('[test-save-prompt] 保存成功:', prompt.id);

    return NextResponse.json({
      success: true,
      message: '视频提示词保存成功',
      data: prompt,
    });
  } catch (error) {
    console.error('[test-save-prompt] 保存失败:', error);
    return NextResponse.json({
      success: false,
      message: `保存失败: ${error instanceof Error ? error.message : '未知错误'}`,
    }, { status: 500 });
  }
}
