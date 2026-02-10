import { NextResponse } from "next/server"
import { sql } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { logger } from "@/shared/logger"
import { getTraceId } from "@/shared/trace"
import { jobs, stories, storyOutlines, storyboards, tvcJobs, tvcStories, tvcStoryOutlines, tvcStoryboards } from "@/shared/schema"
import { ensureTvcSchema } from "@/server/db/ensureTvcSchema"

export const runtime = "nodejs"

export async function POST(req: Request): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const start = Date.now()

  logger.info({
    event: "tvc_db_migrate_start",
    module: "db",
    traceId,
    message: "开始迁移 TVC 数据：public -> tvc schema"
  })

  try {
    await ensureTvcSchema()
    const db = await getDb({ stories, storyOutlines, storyboards, jobs, tvcStories, tvcStoryOutlines, tvcStoryboards, tvcJobs })

    await db.execute(sql`
      insert into tvc.stories (
        id, user_id, title, story_type, resolution, aspect_ratio, style, story_text, generated_text, final_video_url,
        status, progress_stage, metadata, created_at, updated_at
      )
      select
        s.id, s.user_id, s.title, s.story_type, s.resolution, s.aspect_ratio, s.style, s.story_text, s.generated_text, s.final_video_url,
        s.status, s.progress_stage, s.metadata, s.created_at, s.updated_at
      from public.stories s
      where s.story_type = 'tvc'
      on conflict (id) do update set
        user_id = excluded.user_id,
        title = excluded.title,
        story_type = excluded.story_type,
        resolution = excluded.resolution,
        aspect_ratio = excluded.aspect_ratio,
        style = excluded.style,
        story_text = excluded.story_text,
        generated_text = excluded.generated_text,
        final_video_url = excluded.final_video_url,
        status = excluded.status,
        progress_stage = excluded.progress_stage,
        metadata = excluded.metadata,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at
    `)

    await db.execute(sql`
      insert into tvc.story_outlines (
        id, story_id, sequence, outline_text, original_text, created_at
      )
      select
        o.id, o.story_id, o.sequence, o.outline_text, o.original_text, o.created_at
      from public.story_outlines o
      join public.stories s on s.id = o.story_id
      where s.story_type = 'tvc'
      on conflict (id) do update set
        story_id = excluded.story_id,
        sequence = excluded.sequence,
        outline_text = excluded.outline_text,
        original_text = excluded.original_text,
        created_at = excluded.created_at
    `)

    await db.execute(sql`
      insert into tvc.storyboards (
        id, outline_id, sequence, created_at, updated_at,
        shot_cut, storyboard_text, script_content, frames, video_info
      )
      select
        b.id, b.outline_id, b.sequence, b.created_at, b.updated_at,
        b.shot_cut, b.storyboard_text, b.script_content, b.frames, b.video_info
      from public.storyboards b
      join public.story_outlines o on o.id = b.outline_id
      join public.stories s on s.id = o.story_id
      where s.story_type = 'tvc'
      on conflict (id) do update set
        outline_id = excluded.outline_id,
        sequence = excluded.sequence,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        shot_cut = excluded.shot_cut,
        storyboard_text = excluded.storyboard_text,
        script_content = excluded.script_content,
        frames = excluded.frames,
        video_info = excluded.video_info
    `)

    await db.execute(sql`
      insert into tvc.jobs (
        id, user_id, type, status, payload, snapshot, progress_version,
        started_at, finished_at, error_message, created_at, updated_at
      )
      select
        j.id, j.user_id, j.type, j.status, j.payload, j.snapshot, j.progress_version,
        j.started_at, j.finished_at, j.error_message, j.created_at, j.updated_at
      from public.jobs j
      join public.stories s on s.id = j.story_id
      where s.story_type = 'tvc'
      on conflict (id) do update set
        user_id = excluded.user_id,
        type = excluded.type,
        status = excluded.status,
        payload = excluded.payload,
        snapshot = excluded.snapshot,
        progress_version = excluded.progress_version,
        started_at = excluded.started_at,
        finished_at = excluded.finished_at,
        error_message = excluded.error_message,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at
    `)

    await db.execute(sql`
      delete from public.storyboards b
      using public.story_outlines o, public.stories s
      where b.outline_id = o.id and o.story_id = s.id and s.story_type = 'tvc'
    `)

    await db.execute(sql`
      delete from public.stories s
      where s.story_type = 'tvc'
    `)

    const durationMs = Date.now() - start
    logger.info({
      event: "tvc_db_migrate_success",
      module: "db",
      traceId,
      message: "迁移 TVC 数据完成",
      durationMs
    })

    return NextResponse.json(makeApiOk(traceId, { ok: true }), { status: 200 })
  } catch (err) {
    const anyErr = err as { name?: string; message?: string; stack?: string }
    const detail = typeof anyErr?.message === "string" ? anyErr.message : ""
    logger.error({
      event: "tvc_db_migrate_failed",
      module: "db",
      traceId,
      message: "迁移 TVC 数据失败",
      errorName: anyErr?.name,
      errorMessage: detail,
      stack: typeof anyErr?.stack === "string" ? anyErr.stack : undefined
    })
    const message =
      process.env.NODE_ENV === "production" ? "迁移 TVC 数据失败，请检查数据库配置" : `迁移 TVC 数据失败：${detail || "unknown"}`
    return NextResponse.json(makeApiErr(traceId, "TVC_DB_MIGRATE_FAILED", message), { status: 500 })
  }
}
