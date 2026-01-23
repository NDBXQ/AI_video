import { NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';
import { generatedVideos } from '@/storage/database/shared/schema';

export const runtime = 'nodejs';

/**
 * POST /api/test/test-insert-7-fields
 * 测试只插入7个字段
 */
export async function POST() {
  try {
    const db = await getDb();

    // 只插入7个字段（不包括可选字段）
    const result = await db.insert(generatedVideos).values({
      storyId: 'test-story-id-3',
      storyboardId: 'test-storyboard-id-3',
      name: '测试视频3',
      description: '',
      url: 'https://example.com/video3.mp4',
      storageKey: 'test/video3.mp4',
      mode: '首帧',
    }).returning();

    console.log('[test-insert-7-fields] 插入成功，result:', result);

    return NextResponse.json({
      success: true,
      data: {
        video: result[0],
      },
    });
  } catch (error) {
    console.error('[test-insert-7-fields] 插入失败:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '插入失败',
      },
      { status: 500 }
    );
  }
}
