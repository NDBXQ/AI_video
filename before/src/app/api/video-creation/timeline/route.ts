import { NextRequest, NextResponse } from 'next/server';
import { storyboardTextManager } from '@/storage/database/storyboardTextManager';
import { generatedVideoManager } from '@/storage/database/generatedVideoManager';
import { createCozeStorage } from '@/features/video-creation/services/image-generation/storage';

export const runtime = 'nodejs';

/**
 * GET /api/video-creation/timeline?outlineId=xxx
 * 获取指定大纲的所有分镜及其生成的视频
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const outlineId = searchParams.get('outlineId');

    if (!outlineId) {
      return NextResponse.json(
        {
          success: false,
          message: 'outlineId 是必填参数',
        },
        { status: 400 }
      );
    }

    console.log('[timeline] ========== 获取时间线数据 ==========');
    console.log('[timeline] outlineId:', outlineId);

    // 1. 查询该大纲下的所有分镜
    console.log('[timeline] 步骤1: 查询分镜列表...');
    const storyboardTexts = await storyboardTextManager.getStoryboardTextsByOutlineId(outlineId);

    if (!storyboardTexts || storyboardTexts.length === 0) {
      console.log('[timeline] 该大纲下没有分镜');
      return NextResponse.json({
        success: true,
        data: {
          outlineId,
          outlineTitle: '',
          scenes: [],
        },
      });
    }

    console.log('[timeline] 查询到分镜数量:', storyboardTexts.length);

    // 2. 查询每个分镜的生成视频
    console.log('[timeline] 步骤2: 查询视频数据...');
    const storage = createCozeStorage();
    const scenesWithVideo = await Promise.all(
      storyboardTexts.map(async (storyboardText) => {
        const videos = await generatedVideoManager.getGeneratedVideosByStoryboardId(storyboardText.id);

        // 取最新生成的视频（如果有）
        const latestVideo = videos.length > 0 ? videos[videos.length - 1] : null;

        return {
          storyboardId: storyboardText.id,
          sceneTitle: storyboardText.sceneTitle,
          sequence: storyboardText.sequence,
          video: latestVideo
            ? {
                url: latestVideo.url,
                playUrl: await storage.generatePresignedUrl({ key: latestVideo.storageKey }),
                mode: latestVideo.mode,
                duration: latestVideo.duration,
                thumbnailUrl: latestVideo.thumbnailUrl,
                thumbnailPlayUrl:
                  latestVideo.thumbnailStorageKey && latestVideo.thumbnailStorageKey.length > 0
                    ? await storage.generatePresignedUrl({ key: latestVideo.thumbnailStorageKey })
                    : undefined,
                createdAt: latestVideo.createdAt,
              }
            : undefined,
        };
      })
    );

    console.log('[timeline] 步骤3: 返回所有分镜（无论是否有视频）...');
    // 返回所有分镜，前端处理无视频的情况
    // const scenesWithVideoFiltered = scenesWithVideo.filter((scene) => scene.video !== undefined);

    console.log('[timeline] 分镜总数量:', scenesWithVideo.length);
    console.log('[timeline] ========== 获取时间线数据完成 ==========');

    return NextResponse.json({
      success: true,
      data: {
        outlineId,
        outlineTitle: storyboardTexts[0]?.originalText || '',
        scenes: scenesWithVideo,
      },
    });
  } catch (error) {
    console.error('[timeline] 获取时间线数据失败:', error);

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
