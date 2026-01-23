import { NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';
import { sql } from 'drizzle-orm';

export const runtime = 'nodejs';

/**
 * POST /api/test/test-insert
 * 测试直接执行INSERT语句
 */
export async function POST() {
  try {
    const db = await getDb();

    // 直接执行INSERT语句，硬编码所有值
    const result = await db.execute(
      sql`
        INSERT INTO generated_videos (
          story_id,
          scene_id,
          name,
          description,
          url,
          storage_key,
          thumbnail_url,
          thumbnail_storage_key,
          duration,
          mode
        )
        VALUES (
          'test-story-id',
          'test-scene-id',
          '测试视频',
          '这是一个测试视频',
          'https://example.com/video.mp4',
          'test/video.mp4',
          NULL,
          NULL,
          NULL,
          '首帧'
        )
        RETURNING *;
      `
    );

    console.log('[test-insert] 插入成功，result:', result.rows);

    return NextResponse.json({
      success: true,
      data: {
        video: result.rows[0],
      },
    });
  } catch (error) {
    console.error('[test-insert] 插入失败:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '插入失败',
      },
      { status: 500 }
    );
  }
}
