import { NextRequest, NextResponse } from 'next/server';
import { storyManager } from '@/storage/database/storyManager';
import { calcResolution, type AspectRatio, type ResolutionPreset } from '@/lib/story-spec';

export const runtime = 'nodejs';

/**
 * POST /api/story/create
 * 创建新故事
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, storyType, storyText, title, generatedText, runId, aspectRatio, resolutionPreset } = body;

    // 验证必填参数
    if (!userId || !storyType || !storyText) {
      return NextResponse.json(
        {
          success: false,
          message: '缺少必填参数：userId, storyType, storyText',
        },
        { status: 400 }
      );
    }

    // 创建故事
    const aspectOptions = ['16:9', '4:3', '3:4', '9:16'] as const;
    const resolutionOptions = ['480p', '720p', '1080p'] as const;

    const safeAspectRatio: AspectRatio =
      typeof aspectRatio === 'string' && (aspectOptions as readonly string[]).includes(aspectRatio)
        ? (aspectRatio as AspectRatio)
        : '16:9';
    const safeResolutionPreset: ResolutionPreset =
      typeof resolutionPreset === 'string' && (resolutionOptions as readonly string[]).includes(resolutionPreset)
        ? (resolutionPreset as ResolutionPreset)
        : '1080p';
    const computed = calcResolution(safeAspectRatio, safeResolutionPreset);

    const story = await storyManager.createStory({
      userId,
      storyType,
      storyText,
      title: title || null,
      generatedText: generatedText || null,
      runId: runId || null,
      status: 'draft',
      aspectRatio: safeAspectRatio,
      resolutionPreset: safeResolutionPreset,
      resolution: computed.text,
    } as any);

    return NextResponse.json({
      success: true,
      data: story,
      message: '故事创建成功',
    });
  } catch (error) {
    console.error('创建故事失败:', error);
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
