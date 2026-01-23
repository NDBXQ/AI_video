import { NextResponse } from "next/server"
import { sql } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { logger } from "@/shared/logger"
import { getTraceId } from "@/shared/trace"
import { stories, storyOutlines, storyboards } from "@/shared/schema"

/**
 * 获取 stories 与 story_outlines 表结构（列清单）
 * @returns {Promise<Response>} JSON 响应
 */
export async function GET(req: Request): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const start = Date.now()

  logger.info({
    event: "db_schema_inspect_start",
    module: "db",
    traceId,
    message: "开始读取数据表结构"
  })

  try {
    const db = await getDb({ stories, storyOutlines, storyboards })

    const storiesCols = await db.execute(sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'stories'
      ORDER BY ordinal_position
    `)

    const outlinesCols = await db.execute(sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'story_outlines'
      ORDER BY ordinal_position
    `)

    const storyboardsCols = await db.execute(sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'storyboards'
      ORDER BY ordinal_position
    `)

    const durationMs = Date.now() - start
    logger.info({
      event: "db_schema_inspect_success",
      module: "db",
      traceId,
      message: "读取数据表结构成功",
      durationMs
    })

    return NextResponse.json(
      makeApiOk(traceId, {
        stories: (storiesCols as unknown as { rows?: unknown[] }).rows ?? storiesCols,
        story_outlines: (outlinesCols as unknown as { rows?: unknown[] }).rows ?? outlinesCols,
        storyboards: (storyboardsCols as unknown as { rows?: unknown[] }).rows ?? storyboardsCols
      })
    )
  } catch (err) {
    const anyErr = err as { name?: string; message?: string; stack?: string }
    logger.error({
      event: "db_schema_inspect_failed",
      module: "db",
      traceId,
      message: "读取数据表结构失败",
      errorName: anyErr?.name,
      errorMessage: anyErr?.message
    })
    return NextResponse.json(
      makeApiErr(traceId, "DB_SCHEMA_READ_FAILED", "无法读取数据表结构，请检查数据库配置"),
      { status: 500 }
    )
  }
}

export async function POST(req: Request): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const start = Date.now()

  logger.info({
    event: "db_schema_migrate_start",
    module: "db",
    traceId,
    message: "开始执行数据库结构迁移"
  })

  try {
    const db = await getDb({ stories, storyOutlines, storyboards })

    await db.execute(sql`
      ALTER TABLE story_outlines
      ADD COLUMN IF NOT EXISTS outline_drafts jsonb NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS active_outline_draft_id text;
    `)

    await db.execute(sql`
      ALTER TABLE storyboards
      ADD COLUMN IF NOT EXISTS frames jsonb NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS video_info jsonb NOT NULL DEFAULT '{}'::jsonb;
    `)

    await db.execute(sql`
      DO $$
      BEGIN
        IF (
          SELECT count(*) FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'storyboards'
            AND column_name IN (
              'image_url_first_frame',
              'image_thumbnail_url_first_frame',
              'first_frame_prompt',
              'last_frame_prompt',
              'image_url_last_frame',
              'image_thumbnail_url_last_frame'
            )
        ) = 6 THEN
          EXECUTE $q$
            UPDATE storyboards
            SET frames = jsonb_strip_nulls(
              jsonb_build_object(
                'first', jsonb_strip_nulls(jsonb_build_object(
                  'url', image_url_first_frame,
                  'thumbnailUrl', image_thumbnail_url_first_frame,
                  'prompt', first_frame_prompt
                )),
                'last', jsonb_strip_nulls(jsonb_build_object(
                  'url', image_url_last_frame,
                  'thumbnailUrl', image_thumbnail_url_last_frame,
                  'prompt', last_frame_prompt
                ))
              )
            )
            WHERE frames = '{}'::jsonb
          $q$;
        END IF;

        IF (
          SELECT count(*) FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'storyboards'
            AND column_name IN (
              'video_prompt',
              'mode',
              'video_url',
              'video_storage_key',
              'video_duration_seconds',
              'video_generate_audio',
              'video_watermark'
            )
        ) = 7 THEN
          EXECUTE $q$
            UPDATE storyboards
            SET video_info = jsonb_strip_nulls(
              jsonb_build_object(
                'url', video_url,
                'prompt', video_prompt,
                'storageKey', video_storage_key,
                'durationSeconds', video_duration_seconds,
                'settings', jsonb_strip_nulls(jsonb_build_object(
                  'mode', mode,
                  'generateAudio', video_generate_audio,
                  'watermark', video_watermark
                ))
              )
            )
            WHERE video_info = '{}'::jsonb
          $q$;
        END IF;
      END
      $$;
    `)

    await db.execute(sql`
      ALTER TABLE storyboards
      DROP COLUMN IF EXISTS image_url,
      DROP COLUMN IF EXISTS image_thumbnail_url,
      DROP COLUMN IF EXISTS image_prompt,
      DROP COLUMN IF EXISTS image_url_first_frame,
      DROP COLUMN IF EXISTS image_thumbnail_url_first_frame,
      DROP COLUMN IF EXISTS first_frame_prompt,
      DROP COLUMN IF EXISTS last_frame_prompt,
      DROP COLUMN IF EXISTS image_url_last_frame,
      DROP COLUMN IF EXISTS image_thumbnail_url_last_frame,
      DROP COLUMN IF EXISTS video_prompt,
      DROP COLUMN IF EXISTS mode,
      DROP COLUMN IF EXISTS video_url,
      DROP COLUMN IF EXISTS video_storage_key,
      DROP COLUMN IF EXISTS video_duration_seconds,
      DROP COLUMN IF EXISTS video_generate_audio,
      DROP COLUMN IF EXISTS video_watermark;
    `)

    // Create generated_images table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS generated_images (
        id text PRIMARY KEY DEFAULT gen_random_uuid(),
        story_id text NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
        storyboard_id text REFERENCES storyboards(id) ON DELETE CASCADE,
        name text NOT NULL,
        description text,
        url text NOT NULL,
        storage_key text NOT NULL,
        thumbnail_url text,
        thumbnail_storage_key text,
        category text NOT NULL DEFAULT 'reference',
        prompt text,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `)

    await db.execute(sql`
      ALTER TABLE generated_images
      ADD COLUMN IF NOT EXISTS storyboard_id text REFERENCES storyboards(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS thumbnail_url text,
      ADD COLUMN IF NOT EXISTS thumbnail_storage_key text,
      ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'reference',
      ADD COLUMN IF NOT EXISTS prompt text
    `)

    const durationMs = Date.now() - start
    logger.info({
      event: "db_schema_migrate_success",
      module: "db",
      traceId,
      message: "数据库结构迁移成功",
      durationMs
    })

    return NextResponse.json(makeApiOk(traceId, { ok: true }), { status: 200 })
  } catch (err) {
    const anyErr = err as { name?: string; message?: string }
    logger.error({
      event: "db_schema_migrate_failed",
      module: "db",
      traceId,
      message: "数据库结构迁移失败",
      errorName: anyErr?.name,
      errorMessage: anyErr?.message
    })
    return NextResponse.json(makeApiErr(traceId, "DB_SCHEMA_MIGRATE_FAILED", "无法执行数据库结构迁移，请检查数据库配置"), {
      status: 500
    })
  }
}
