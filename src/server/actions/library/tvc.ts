"use server"

import { cookies } from "next/headers"
import { getDb } from "coze-coding-dev-sdk"
import { and, eq } from "drizzle-orm"
import { tvcStories } from "@/shared/schema/tvc"
import { logger } from "@/shared/logger"
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { ensureTvcSchema } from "@/server/db/ensureTvcSchema"

export async function deleteTvcProject(projectId: string): Promise<{ success: boolean }> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  const traceId = getTraceId(new Headers())
  const start = Date.now()

  if (!token) return { success: false }

  const session = await verifySessionToken(token, traceId)
  if (!session) return { success: false }

  await ensureTvcSchema()

  logger.info({
    event: "tvc_project_delete_start",
    module: "tvc",
    traceId,
    message: "开始删除 TVC 项目",
    projectId
  })

  const db = await getDb({ tvcStories })
  const allowed = await db
    .select({ id: tvcStories.id })
    .from(tvcStories)
    .where(and(eq(tvcStories.id, projectId), eq(tvcStories.userId, session.userId), eq(tvcStories.storyType, "tvc")))
    .limit(1)

  if (allowed.length === 0) return { success: false }

  await db.delete(tvcStories).where(and(eq(tvcStories.id, projectId), eq(tvcStories.userId, session.userId)))

  logger.info({
    event: "tvc_project_delete_success",
    module: "tvc",
    traceId,
    message: "删除 TVC 项目成功",
    durationMs: Date.now() - start,
    projectId
  })

  return { success: true }
}
