import { NextRequest, NextResponse } from 'next/server';
import { storyManager } from '@/storage/database/storyManager';
import { calcResolution, type AspectRatio, type ResolutionPreset } from '@/lib/story-spec';

export const runtime = 'nodejs';

/**
 * GET /api/story/[id]
 * 获取指定ID的作品信息
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message: '缺少必填参数：id',
        },
        { status: 400 }
      );
    }

    const story = await storyManager.getStoryById(id);

    if (!story) {
      return NextResponse.json(
        {
          success: false,
          message: '作品不存在',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: story,
      message: '获取作品信息成功',
    });
  } catch (error) {
    console.error('获取作品信息失败:', error);
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
 * PATCH /api/story/[id]
 * 更新指定ID的作品信息
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message: '缺少必填参数：id',
        },
        { status: 400 }
      );
    }

    const aspectOptions = ['16:9', '4:3', '3:4', '9:16'] as const;
    const resolutionOptions = ['480p', '720p', '1080p'] as const;
    const nextAspectRatio: AspectRatio | null =
      typeof body?.aspectRatio === 'string' && (aspectOptions as readonly string[]).includes(body.aspectRatio)
        ? (body.aspectRatio as AspectRatio)
        : null;
    const nextResolutionPreset: ResolutionPreset | null =
      typeof body?.resolutionPreset === 'string' &&
      (resolutionOptions as readonly string[]).includes(body.resolutionPreset)
        ? (body.resolutionPreset as ResolutionPreset)
        : null;

    if (nextAspectRatio || nextResolutionPreset) {
      const current = await storyManager.getStoryById(id);
      const safeAspectRatio: AspectRatio =
        nextAspectRatio ||
        (typeof current?.aspectRatio === 'string' && (aspectOptions as readonly string[]).includes(current.aspectRatio)
          ? (current.aspectRatio as AspectRatio)
          : '16:9');
      const safeResolutionPreset: ResolutionPreset =
        nextResolutionPreset ||
        (typeof (current as any)?.resolutionPreset === 'string' &&
        (resolutionOptions as readonly string[]).includes((current as any).resolutionPreset)
          ? ((current as any).resolutionPreset as ResolutionPreset)
          : '1080p');
      body.aspectRatio = safeAspectRatio;
      body.resolutionPreset = safeResolutionPreset;
      body.resolution = calcResolution(safeAspectRatio, safeResolutionPreset).text;
    }

    const updatedStory = await storyManager.updateStory(id, body);

    if (!updatedStory) {
      return NextResponse.json(
        {
          success: false,
          message: '作品不存在或更新失败',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedStory,
      message: '更新作品信息成功',
    });
  } catch (error) {
    console.error('更新作品信息失败:', error);
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
