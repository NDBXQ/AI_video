import { sql } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { iterationTasks } from "@/shared/schema/telemetry"

let ensured = false

export async function ensureIterationTasksTable(): Promise<void> {
  if (ensured) return
  const db = await getDb({ iterationTasks })
  await db.execute(sql`
    create table if not exists iteration_tasks (
      id text primary key default gen_random_uuid(),
      module text not null,
      title text not null,
      status text not null default 'proposed',
      spec jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz
    );
  `)
  await db.execute(sql`create index if not exists idx_iteration_tasks_module_status_created on iteration_tasks (module, status, created_at);`)
  ensured = true
}
