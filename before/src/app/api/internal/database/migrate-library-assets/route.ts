import { NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const db = await getDb();

    const exists = await db.execute(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'library_assets'
      );
    `);

    if (!exists.rows[0].exists) {
      await db.execute(`
        CREATE TABLE library_assets (
          id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id VARCHAR(36) DEFAULT NULL,
          type VARCHAR(20) NOT NULL,
          source VARCHAR(20) NOT NULL,
          title TEXT DEFAULT NULL,
          prompt TEXT DEFAULT NULL,
          tags JSONB NOT NULL DEFAULT '[]'::jsonb,
          mime_type VARCHAR(128) DEFAULT NULL,
          size INTEGER DEFAULT NULL,
          url TEXT NOT NULL,
          storage_key TEXT NOT NULL,
          thumbnail_url TEXT DEFAULT NULL,
          thumbnail_storage_key TEXT DEFAULT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
        );
      `);

      await db.execute(`
        CREATE INDEX library_assets_type_idx ON library_assets USING btree (type ASC NULLS LAST);
      `);

      await db.execute(`
        CREATE INDEX library_assets_user_id_idx ON library_assets USING btree (user_id ASC NULLS LAST);
      `);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[migrate-library-assets] failed:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

