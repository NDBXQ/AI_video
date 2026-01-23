import { NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';
import { sql } from 'drizzle-orm';

export const runtime = 'nodejs';

/**
 * POST /api/test/test-insert-minimal
 * 测试只插入必需字段
 */
export async function POST() {
  try {
    const db = await getDb();

    // 只插入必需字段
    const result = await db.execute(
      sql`
        INSERT INTO generated_videos (
          story_id,
          scene_id,
          name,
          url,
          storage_key,
          mode
        )
        VALUES (
          'test-story-id',
          'test-scene-id',
          '测试视频',
          'https://example.com/video.mp4',
          'test/video.mp4',
          '首帧'
        )
        RETURNING *;
      `
    );

    console.log('[test-insert-minimal] 插入成功，result:', result.rows);

    return NextResponse.json({
      success: true,
      data: {
        video: result.rows[0],
      },
    });
  } catch (error) {
    console.error('[test-insert-minimal] 插入失败:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '插入失败',
      },
      { status: 500 }
    );
  }
}
