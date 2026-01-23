import { NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const db = await getDb();

    const exists = await db.execute(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'public_resources'
      );
    `);

    if (!exists.rows[0].exists) {
      await db.execute(`
        CREATE TABLE public_resources (
          id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
          type VARCHAR(20) NOT NULL,
          source VARCHAR(20) NOT NULL,
          name TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          preview_url TEXT NOT NULL,
          preview_storage_key TEXT DEFAULT NULL,
          original_url TEXT DEFAULT NULL,
          original_storage_key TEXT DEFAULT NULL,
          tags JSONB NOT NULL DEFAULT '[]'::jsonb,
          applicable_scenes JSONB NOT NULL DEFAULT '[]'::jsonb,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
        );
      `);

      await db.execute(`
        CREATE INDEX public_resources_type_idx ON public_resources USING btree (type ASC NULLS LAST);
      `);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[migrate-public-resources] failed:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

