import { NextResponse } from 'next/server';
import { generatedVideoManager } from '@/storage/database/generatedVideoManager';

export const runtime = 'nodejs';

/**
 * POST /api/test/insert-video
 * 测试插入视频记录
 */
export async function POST() {
  try {
    console.log('[test-insert-video] 开始测试插入视频记录...');

    const video = await generatedVideoManager.createGeneratedVideo({
      storyId: 'test-story-id',
      storyboardId: 'test-storyboard-id',
      name: '测试视频',
      description: '这是一个测试视频',
      url: 'https://example.com/video.mp4',
      storageKey: 'test/video.mp4',
      mode: '首帧',
    });

    console.log('[test-insert-video] ✅ 插入成功:', video);

    return NextResponse.json({
      success: true,
      data: {
        video,
      },
    });
  } catch (error) {
    console.error('[test-insert-video] 插入失败，完整错误:', error);
    console.error(
      '[test-insert-video] 错误类型:',
      error instanceof Error ? error.constructor.name : typeof error
    );
    console.error('[test-insert-video] 错误消息:', error instanceof Error ? error.message : String(error));
    console.error('[test-insert-video] 错误堆栈:', error instanceof Error ? error.stack : undefined);

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '插入失败',
      },
      { status: 500 }
    );
  }
}
