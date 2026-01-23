import { NextRequest, NextResponse } from 'next/server';
import { promptsManager } from '@/storage/database/promptsManager';
import { normalizeStoryboardId } from '@/features/video-creation/services/image-generation/story';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const storyboardIdParam = searchParams.get('storyboardId');
    if (!storyboardIdParam) {
      return NextResponse.json(
        {
          success: false,
          message: '缺少必填参数 storyboardId',
        },
        { status: 400 }
      );
    }

    const storyboardId = normalizeStoryboardId(storyboardIdParam);
    const record = await promptsManager.getPromptByStoryboardId(storyboardId);
    if (!record) {
      return NextResponse.json({
        success: true,
        data: null,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: record.id,
        storyboardId: record.storyboardId,
        videoPrompt: record.videoPrompt || '',
        imagePromptType: record.imagePromptType || '',
        imagePrompt: record.imagePrompt || '',
        runId: record.runId || '',
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      },
    });
  } catch (error) {
    console.error('[prompts] 获取提示词失败:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return NextResponse.json(
      {
        success: false,
        message: `获取失败: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}
