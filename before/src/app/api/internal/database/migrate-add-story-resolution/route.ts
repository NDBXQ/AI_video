import { NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const db = await getDb();

    await db.execute(`
      ALTER TABLE stories
      ADD COLUMN IF NOT EXISTS resolution VARCHAR(15) NOT NULL DEFAULT '1920x1080';
    `);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[migrate-add-story-resolution] failed:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

