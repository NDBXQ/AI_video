import { NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';
import { generatedVideos } from '@/storage/database/shared/schema';

export const runtime = 'nodejs';

/**
 * POST /api/test/test-drizzle-insert
 * 测试Drizzle的insert方法
 */
export async function POST() {
  try {
    const db = await getDb();

    // 使用Drizzle的insert方法
    const result = await db
      .insert(generatedVideos)
      .values({
        storyId: 'test-story-id-2',
        storyboardId: 'test-storyboard-id-2',
        name: '测试视频2',
        description: '这是一个测试视频2',
        url: 'https://example.com/video2.mp4',
        storageKey: 'test/video2.mp4',
        thumbnailUrl: null,
        thumbnailStorageKey: null,
        duration: null,
        mode: '首帧',
      } as any)
      .returning();

    console.log('[test-drizzle-insert] 插入成功，result:', result);

    return NextResponse.json({
      success: true,
      data: {
        video: result[0],
      },
    });
  } catch (error) {
    console.error('[test-drizzle-insert] 插入失败:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '插入失败',
      },
      { status: 500 }
    );
  }
}
