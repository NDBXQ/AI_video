import { NextRequest, NextResponse } from 'next/server';
import { generatedVideoManager } from '@/storage/database/generatedVideoManager';
import { createCozeStorage } from '@/features/video-creation/services/image-generation/storage';

export const runtime = 'nodejs';

/**
 * GET /api/video-creation/videos?storyboardId=xxx
 * 获取指定分镜的所有生成的视频
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const storyboardId = searchParams.get('storyboardId');
    const storyId = searchParams.get('storyId');

    if (!storyboardId && !storyId) {
      return NextResponse.json(
        {
          success: false,
          message: 'storyboardId 或 storyId 必须提供一个',
        },
        { status: 400 }
      );
    }

    let videos;

    if (storyboardId) {
      // 获取指定分镜的视频
      videos = await generatedVideoManager.getGeneratedVideosByStoryboardId(storyboardId);
    } else {
      // 获取指定故事的所有视频
      videos = await generatedVideoManager.getGeneratedVideosByStoryId(storyId!);
    }

    const storage = createCozeStorage();
    const videosWithPlayUrl = await Promise.all(
      (videos || []).map(async (video: any) => {
        try {
          const playUrl = await storage.generatePresignedUrl({ key: video.storageKey });
          const thumbnailPlayUrl =
            video.thumbnailStorageKey && typeof video.thumbnailStorageKey === 'string' && video.thumbnailStorageKey.length > 0
              ? await storage.generatePresignedUrl({ key: video.thumbnailStorageKey })
              : undefined;

          return {
            ...video,
            playUrl,
            thumbnailPlayUrl,
          };
        } catch {
          return video;
        }
      })
    );

    return NextResponse.json({
      success: true,
      data: videosWithPlayUrl,
    });
  } catch (error) {
    console.error('获取视频列表失败:', error);

    const errorMessage =
      error instanceof Error ? error.message : '未知错误';

    return NextResponse.json(
      {
        success: false,
        message: `获取失败: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}
