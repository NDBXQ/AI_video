import { NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const db = await getDb();

    await db.execute(`
      ALTER TABLE stories
      ADD COLUMN IF NOT EXISTS resolution_preset VARCHAR(10) NOT NULL DEFAULT '1080p';
    `);

    await db.execute(`
      UPDATE stories
      SET resolution_preset =
        CASE
          WHEN resolution_preset IS NULL OR resolution_preset = '' THEN '1080p'
          WHEN resolution_preset IN ('480p','720p','1080p') THEN resolution_preset
          ELSE '1080p'
        END;
    `);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[migrate-add-story-resolution-preset] failed:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

