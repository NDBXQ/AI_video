import { sql } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { tvcAssets, tvcChatMessages, tvcJobs, tvcLlmMessages, tvcStories, tvcStoryOutlines, tvcStoryboards } from "@/shared/schema/tvc"

const ENSURE_VERSION = 11

export async function ensureTvcSchema(): Promise<void> {
  const g = globalThis as any
  const db = await getDb({ tvcStories, tvcStoryOutlines, tvcStoryboards, tvcChatMessages, tvcLlmMessages, tvcJobs, tvcAssets })

  if (g.__tvcSchemaEnsuredVersion === ENSURE_VERSION) {
    try {
      const exists = await db.execute(sql`
        select
          to_regclass('tvc.stories') as stories,
          to_regclass('tvc.story_outlines') as outlines,
          to_regclass('tvc.storyboards') as storyboards
      `)
      const row = (exists as any)?.rows?.[0] ?? null
      if (row?.stories && row?.outlines && row?.storyboards) return
    } catch {
    }
  }

  await db.execute(sql`create schema if not exists tvc;`)

  await db.execute(sql`drop table if exists tvc.agent_steps cascade;`)

  await db.execute(sql`
    do $$
    declare k text;
    begin
      select c.relkind::text into k
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'tvc' and c.relname = 'stories'
      limit 1;
      if k = 'v' then execute 'drop view tvc.stories cascade'; end if;
      if k = 'm' then execute 'drop materialized view tvc.stories cascade'; end if;
      k := null;

      select c.relkind::text into k
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'tvc' and c.relname = 'story_outlines'
      limit 1;
      if k = 'v' then execute 'drop view tvc.story_outlines cascade'; end if;
      if k = 'm' then execute 'drop materialized view tvc.story_outlines cascade'; end if;
      k := null;

      select c.relkind::text into k
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'tvc' and c.relname = 'storyboards'
      limit 1;
      if k = 'v' then execute 'drop view tvc.storyboards cascade'; end if;
      if k = 'm' then execute 'drop materialized view tvc.storyboards cascade'; end if;
      k := null;

      select c.relkind::text into k
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'tvc' and c.relname = 'jobs'
      limit 1;
      if k = 'v' then execute 'drop view tvc.jobs cascade'; end if;
      if k = 'm' then execute 'drop materialized view tvc.jobs cascade'; end if;
      k := null;

      select c.relkind::text into k
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'tvc' and c.relname = 'generated_images'
      limit 1;
      if k = 'v' then execute 'drop view tvc.generated_images cascade'; end if;
      if k = 'm' then execute 'drop materialized view tvc.generated_images cascade'; end if;
      if k = 'r' then execute 'drop table tvc.generated_images cascade'; end if;
      k := null;

      select c.relkind::text into k
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'tvc' and c.relname = 'generated_audios'
      limit 1;
      if k = 'v' then execute 'drop view tvc.generated_audios cascade'; end if;
      if k = 'm' then execute 'drop materialized view tvc.generated_audios cascade'; end if;
      if k = 'r' then execute 'drop table tvc.generated_audios cascade'; end if;
      k := null;

      select c.relkind::text into k
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'tvc' and c.relname = 'assets'
      limit 1;
      if k = 'v' then execute 'drop view tvc.assets cascade'; end if;
      if k = 'm' then execute 'drop materialized view tvc.assets cascade'; end if;
    end $$;
  `)

  await db.execute(sql`
    create table if not exists tvc.stories (
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
    create table if not exists tvc.story_outlines (
      id text primary key default gen_random_uuid(),
      story_id text not null references tvc.stories(id) on delete cascade,
      sequence integer not null,
      outline_text text not null,
      original_text text not null,
      created_at timestamptz not null default now()
    );
  `)

  await db.execute(sql`alter table if exists tvc.story_outlines drop column if exists outline_drafts;`)
  await db.execute(sql`alter table if exists tvc.story_outlines drop column if exists active_outline_draft_id;`)

  await db.execute(sql`
    create table if not exists tvc.storyboards (
      id text primary key default gen_random_uuid(),
      outline_id text not null,
      sequence integer not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz,
      shot_cut boolean not null default false,
      storyboard_text text not null default '',
      script_content jsonb,
      frames jsonb not null default '{}'::jsonb,
      video_info jsonb not null default '{}'::jsonb
    );
  `)

  await db.execute(sql`alter table if exists tvc.storyboards drop column if exists is_reference_generated;`)
  await db.execute(sql`alter table if exists tvc.storyboards drop column if exists is_video_generated;`)
  await db.execute(sql`alter table if exists tvc.storyboards drop column if exists is_script_generated;`)
  await db.execute(sql`alter table if exists tvc.storyboards drop column if exists scene_title;`)
  await db.execute(sql`alter table if exists tvc.storyboards drop column if exists original_text;`)

  await db.execute(sql`
    create table if not exists tvc.chat_messages (
      id text primary key default gen_random_uuid(),
      story_id text not null references tvc.stories(id) on delete cascade,
      role text not null,
      content text not null,
      created_at timestamptz not null default now()
    );
  `)

  await db.execute(sql`
    create table if not exists tvc.llm_messages (
      id text primary key default gen_random_uuid(),
      story_id text not null references tvc.stories(id) on delete cascade,
      seq integer not null default 0,
      role text not null,
      content text not null,
      name text,
      tool_call_id text,
      tool_calls jsonb,
      created_at timestamptz not null default now()
    );
  `)
  await db.execute(sql`alter table if exists tvc.llm_messages drop column if exists run_id;`)

  await db.execute(sql`
    create table if not exists tvc.jobs (
      id text primary key default gen_random_uuid(),
      user_id text not null,
      type text not null,
      status text not null,
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
  await db.execute(sql`alter table if exists tvc.jobs drop column if exists story_id;`)
  await db.execute(sql`alter table if exists tvc.jobs drop column if exists storyboard_id;`)
  await db.execute(sql`drop index if exists tvc_llm_messages_story_id_run_id_seq_idx;`)

  await db.execute(sql`
    create table if not exists tvc.assets (
      id text primary key default gen_random_uuid(),
      story_id text not null references tvc.stories(id) on delete cascade,
      kind text not null,
      asset_ordinal integer not null,
      storage_key text not null,
      thumbnail_storage_key text,
      mime_type text,
      meta jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `)

  await db.execute(sql`
    do $$
    begin
      execute 'drop index if exists tvc_assets_story_session_kind_asset_index_uq';
      execute 'drop index if exists tvc_assets_story_kind_asset_index_uq';

      if exists (
        select 1
        from information_schema.columns
        where table_schema = 'tvc'
          and table_name = 'assets'
          and column_name = 'asset_index'
      ) then
        if exists (
          select 1
          from information_schema.columns
          where table_schema = 'tvc'
            and table_name = 'assets'
            and column_name = 'asset_ordinal'
        ) then
          execute 'update tvc.assets set asset_ordinal = asset_index where asset_ordinal is null and asset_index is not null';

          if exists (
            select 1
            from tvc.assets
            where asset_index is not null
              and asset_ordinal is not null
              and asset_index <> asset_ordinal
            limit 1
          ) then
            raise exception 'tvc.assets has mismatched asset_index and asset_ordinal values';
          end if;

          execute 'alter table tvc.assets drop column asset_index';
        else
          execute 'alter table tvc.assets rename column asset_index to asset_ordinal';
        end if;
      end if;

      if exists (
        select 1
        from information_schema.columns
        where table_schema = 'tvc'
          and table_name = 'assets'
          and column_name = 'asset_ordinal'
      ) then
        execute 'create unique index if not exists tvc_assets_story_kind_asset_ordinal_uq on tvc.assets(story_id, kind, asset_ordinal)';
      else
        raise exception 'tvc.assets missing asset_ordinal column after ensure';
      end if;
    end $$;
  `)

  await db.execute(sql`alter table if exists tvc.assets drop column if exists session_id;`)

  await db.execute(sql`create index if not exists tvc_story_outlines_story_id_idx on tvc.story_outlines(story_id);`)
  await db.execute(sql`create index if not exists tvc_chat_messages_story_id_created_at_idx on tvc.chat_messages(story_id, created_at);`)
  await db.execute(sql`create index if not exists tvc_llm_messages_story_id_created_at_idx on tvc.llm_messages(story_id, created_at);`)
  g.__tvcSchemaEnsuredVersion = ENSURE_VERSION
}
