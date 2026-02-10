import { sql } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { users } from "@/shared/schema/auth"
import { generatedAudios, generatedImages, ttsSpeakerSamples } from "@/shared/schema/generation"
import { jobs } from "@/shared/schema/jobs"
import { publicResources, sharedResources } from "@/shared/schema/library"
import { stories, storyOutlines, storyboards } from "@/shared/schema/story"
import { iterationTasks, telemetryEvents } from "@/shared/schema/telemetry"
import { logger } from "@/shared/logger"

const ENSURE_VERSION = 3

export async function ensurePublicSchema(): Promise<void> {
  const g = globalThis as any
  if (g.__publicSchemaEnsuredVersion === ENSURE_VERSION) return
  if (g.__publicSchemaEnsuring) return g.__publicSchemaEnsuring as Promise<void>

  g.__publicSchemaEnsuring = (async () => {
    const start = performance.now()
    const db = await getDb({
      users,
      stories,
      storyOutlines,
      storyboards,
      generatedImages,
      generatedAudios,
      ttsSpeakerSamples,
      jobs,
      publicResources,
      sharedResources,
      telemetryEvents,
      iterationTasks
    })

    try {
      await db.execute(sql`create extension if not exists pgcrypto;`)
    } catch {}

    await db.execute(sql`
      do $$
      declare k text;
      begin
        select c.relkind::text into k
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = 'users' limit 1;
        if k = 'v' then execute 'drop view public.users cascade'; end if;
        if k = 'm' then execute 'drop materialized view public.users cascade'; end if;
        k := null;

        select c.relkind::text into k
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = 'stories' limit 1;
        if k = 'v' then execute 'drop view public.stories cascade'; end if;
        if k = 'm' then execute 'drop materialized view public.stories cascade'; end if;
        k := null;

        select c.relkind::text into k
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = 'story_outlines' limit 1;
        if k = 'v' then execute 'drop view public.story_outlines cascade'; end if;
        if k = 'm' then execute 'drop materialized view public.story_outlines cascade'; end if;
        k := null;

        select c.relkind::text into k
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = 'storyboards' limit 1;
        if k = 'v' then execute 'drop view public.storyboards cascade'; end if;
        if k = 'm' then execute 'drop materialized view public.storyboards cascade'; end if;
        k := null;

        select c.relkind::text into k
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = 'generated_images' limit 1;
        if k = 'v' then execute 'drop view public.generated_images cascade'; end if;
        if k = 'm' then execute 'drop materialized view public.generated_images cascade'; end if;
        k := null;

        select c.relkind::text into k
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = 'generated_audios' limit 1;
        if k = 'v' then execute 'drop view public.generated_audios cascade'; end if;
        if k = 'm' then execute 'drop materialized view public.generated_audios cascade'; end if;
        k := null;

        select c.relkind::text into k
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = 'jobs' limit 1;
        if k = 'v' then execute 'drop view public.jobs cascade'; end if;
        if k = 'm' then execute 'drop materialized view public.jobs cascade'; end if;
        k := null;

        select c.relkind::text into k
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = 'public_resources' limit 1;
        if k = 'v' then execute 'drop view public.public_resources cascade'; end if;
        if k = 'm' then execute 'drop materialized view public.public_resources cascade'; end if;
        k := null;

        select c.relkind::text into k
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = 'shared_resources' limit 1;
        if k = 'v' then execute 'drop view public.shared_resources cascade'; end if;
        if k = 'm' then execute 'drop materialized view public.shared_resources cascade'; end if;
        k := null;

        select c.relkind::text into k
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = 'telemetry_events' limit 1;
        if k = 'v' then execute 'drop view public.telemetry_events cascade'; end if;
        if k = 'm' then execute 'drop materialized view public.telemetry_events cascade'; end if;
        k := null;

        select c.relkind::text into k
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = 'iteration_tasks' limit 1;
        if k = 'v' then execute 'drop view public.iteration_tasks cascade'; end if;
        if k = 'm' then execute 'drop materialized view public.iteration_tasks cascade'; end if;
        k := null;

        select c.relkind::text into k
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = 'tts_speaker_samples' limit 1;
        if k = 'v' then execute 'drop view public.tts_speaker_samples cascade'; end if;
        if k = 'm' then execute 'drop materialized view public.tts_speaker_samples cascade'; end if;
      end $$;
    `)

    await db.execute(sql`
      create table if not exists public.users (
        id text primary key default gen_random_uuid(),
        name text not null,
        email text,
        is_active boolean not null default true,
        metadata text,
        created_at timestamptz not null default now(),
        updated_at timestamptz,
        password text not null
      );
    `)

    await db.execute(sql`
      create table if not exists public.stories (
        id text primary key default gen_random_uuid(),
        user_id text not null,
        title text,
        story_type text,
        resolution text not null,
        aspect_ratio text not null default '16:9',
        style text not null default 'cinema',
        story_text text not null,
        generated_text text,
        final_video_url text,
        status text not null default 'draft',
        progress_stage text not null default 'outline',
        metadata jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz
      );
    `)

    await db.execute(sql`
      create table if not exists public.story_outlines (
        id text primary key default gen_random_uuid(),
        story_id text not null references public.stories(id) on delete cascade,
        sequence integer not null,
        outline_text text not null,
        original_text text not null,
        outline_drafts jsonb not null default '[]'::jsonb,
        active_outline_draft_id text,
        created_at timestamptz not null default now()
      );
    `)

    await db.execute(sql`
      create table if not exists public.storyboards (
        id text primary key default gen_random_uuid(),
        outline_id text not null,
        sequence integer not null,
        scene_title text not null,
        original_text text not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz,
        is_reference_generated boolean not null default false,
        shot_cut boolean not null default false,
        storyboard_text text not null default '',
        is_video_generated boolean not null default false,
        is_script_generated boolean not null default false,
        script_content jsonb,
        frames jsonb not null default '{}'::jsonb,
        video_info jsonb not null default '{}'::jsonb
      );
    `)

    await db.execute(sql`
      create table if not exists public.generated_images (
        id text primary key default gen_random_uuid(),
        story_id text not null references public.stories(id) on delete cascade,
        storyboard_id text references public.storyboards(id) on delete cascade,
        name text not null,
        description text,
        url text not null,
        storage_key text not null,
        thumbnail_url text,
        thumbnail_storage_key text,
        category text not null default 'reference',
        prompt text,
        created_at timestamptz not null default now()
      );
    `)

    await db.execute(sql`
      create table if not exists public.generated_audios (
        id text primary key default gen_random_uuid(),
        story_id text not null references public.stories(id) on delete cascade,
        storyboard_id text references public.storyboards(id) on delete cascade,
        role_name text not null,
        speaker_id text not null,
        speaker_name text not null,
        content text not null,
        url text not null,
        storage_key text not null,
        audio_size integer not null default 0,
        created_at timestamptz not null default now()
      );
    `)

    await db.execute(sql`
      create table if not exists public.tts_speaker_samples (
        id text primary key default gen_random_uuid(),
        speaker_id text not null,
        speaker_name text not null,
        sample_text text not null,
        url text not null,
        storage_key text not null,
        audio_size integer not null default 0,
        created_at timestamptz not null default now()
      );
    `)

    await db.execute(sql`
      create table if not exists public.jobs (
        id text primary key default gen_random_uuid(),
        user_id text not null,
        type text not null,
        status text not null,
        story_id text references public.stories(id) on delete cascade,
        storyboard_id text references public.storyboards(id) on delete set null,
        payload jsonb not null,
        snapshot jsonb not null,
        progress_version integer not null default 0,
        started_at timestamptz,
        finished_at timestamptz,
        error_message text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
    `)

    await db.execute(sql`
      create table if not exists public.public_resources (
        id text primary key default gen_random_uuid(),
        user_id text,
        type text not null,
        source text not null,
        name text not null,
        description text not null default '',
        preview_url text not null,
        preview_storage_key text,
        original_url text,
        original_storage_key text,
        duration_ms integer,
        tags jsonb not null default '[]'::jsonb,
        applicable_scenes jsonb not null default '[]'::jsonb,
        created_at timestamptz not null default now()
      );
    `)

    await db.execute(sql`alter table public.public_resources add column if not exists duration_ms integer;`)
    await db.execute(sql`alter table public.public_resources add column if not exists preview_storage_key text;`)
    await db.execute(sql`alter table public.public_resources add column if not exists original_url text;`)
    await db.execute(sql`alter table public.public_resources add column if not exists original_storage_key text;`)
    await db.execute(sql`alter table public.public_resources add column if not exists tags jsonb not null default '[]'::jsonb;`)
    await db.execute(sql`alter table public.public_resources add column if not exists applicable_scenes jsonb not null default '[]'::jsonb;`)

    await db.execute(sql`
      create table if not exists public.shared_resources (
        id text primary key default gen_random_uuid(),
        type text not null,
        source text not null,
        name text not null,
        description text not null default '',
        preview_url text not null,
        preview_storage_key text,
        original_url text,
        original_storage_key text,
        tags jsonb not null default '[]'::jsonb,
        applicable_scenes jsonb not null default '[]'::jsonb,
        created_at timestamptz not null default now()
      );
    `)
    await db.execute(sql`alter table public.shared_resources add column if not exists preview_storage_key text;`)
    await db.execute(sql`alter table public.shared_resources add column if not exists original_url text;`)
    await db.execute(sql`alter table public.shared_resources add column if not exists original_storage_key text;`)
    await db.execute(sql`alter table public.shared_resources add column if not exists tags jsonb not null default '[]'::jsonb;`)
    await db.execute(sql`alter table public.shared_resources add column if not exists applicable_scenes jsonb not null default '[]'::jsonb;`)

    await db.execute(sql`
      create table if not exists public.telemetry_events (
        id text primary key default gen_random_uuid(),
        trace_id text not null,
        user_id text,
        page text not null,
        event text not null,
        payload jsonb not null default '{}'::jsonb,
        user_agent text,
        referrer text,
        created_at timestamptz not null default now()
      );
    `)

    await db.execute(sql`
      create table if not exists public.iteration_tasks (
        id text primary key default gen_random_uuid(),
        module text not null,
        title text not null,
        status text not null default 'proposed',
        spec jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz
      );
    `)

    await db.execute(sql`create index if not exists story_outlines_story_id_idx on public.story_outlines(story_id);`)
    await db.execute(sql`create index if not exists generated_images_story_id_idx on public.generated_images(story_id);`)
    await db.execute(sql`create index if not exists generated_audios_story_id_idx on public.generated_audios(story_id);`)
    await db.execute(sql`create index if not exists jobs_story_id_idx on public.jobs(story_id);`)
    await db.execute(sql`create index if not exists telemetry_events_trace_id_idx on public.telemetry_events(trace_id);`)

    const durationMs = Math.round(performance.now() - start)
    logger.info({ event: "db_public_schema_ready", module: "db", traceId: "startup", message: "public schema 已就绪", durationMs })

    g.__publicSchemaEnsuredVersion = ENSURE_VERSION
  })()

  try {
    await g.__publicSchemaEnsuring
  } finally {
    g.__publicSchemaEnsuring = null
  }
}
