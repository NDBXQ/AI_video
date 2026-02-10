import { sql } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { telemetryEvents } from "@/shared/schema/telemetry"

let ensured = false

export async function ensureTelemetryTable(): Promise<void> {
  if (ensured) return
  const db = await getDb({ telemetryEvents })
  await db.execute(sql`
    create table if not exists telemetry_events (
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
  await db.execute(sql`create index if not exists idx_telemetry_events_page_event_created on telemetry_events (page, event, created_at);`)
  await db.execute(sql`create index if not exists idx_telemetry_events_user_id_created on telemetry_events (user_id, created_at);`)
  ensured = true
}
