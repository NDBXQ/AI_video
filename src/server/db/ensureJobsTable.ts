import { sql } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { generatedImages, jobs, stories, storyOutlines, storyboards } from "@/shared/schema"

let ensured = false

export async function ensureJobsTable(): Promise<void> {
  if (ensured) return
  const db = await getDb({ jobs, generatedImages, stories, storyOutlines, storyboards })
  await db.execute(sql`
    create table if not exists jobs (
      id text primary key default gen_random_uuid(),
      user_id text not null,
      type text not null,
      status text not null,
      story_id text references stories(id) on delete cascade,
      storyboard_id text references storyboards(id) on delete set null,
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
  await db.execute(sql`create index if not exists idx_jobs_type_status_created on jobs (type, status, created_at);`)
  await db.execute(sql`create index if not exists idx_jobs_user_id on jobs (user_id);`)
  ensured = true
}

