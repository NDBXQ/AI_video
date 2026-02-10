import { ensureTvcSchema } from "@/server/db/ensureTvcSchema"
import { ServiceError } from "@/server/shared/errors"
import { tvcLlmMessages, tvcStories } from "@/shared/schema/tvc"
import { and, eq } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import type { TvcLlmMessage } from "../llm/llmTypes"
import { auditDebug, auditError, summarizeLlmMessage } from "@/shared/logAudit"

export async function appendStoryLlmMessages(params: {
  storyId: string
  userId: string
  runId: string
  messages: TvcLlmMessage[]
}): Promise<void> {
  const storyId = String(params.storyId ?? "").trim()
  const userId = String(params.userId ?? "").trim()
  const runId = String(params.runId ?? "").trim()
  if (!storyId || !userId || !runId) throw new ServiceError("VALIDATION_FAILED", "缺少 storyId/userId/runId")
  if (!Array.isArray(params.messages) || params.messages.length === 0) return

  auditDebug(
    "tvc_context",
    "llm_messages_append_start",
    "准备写入 llm_messages",
    { traceId: runId, storyId, runId },
    {
      messageCount: params.messages.length,
      roles: params.messages.reduce(
        (acc, m) => {
          const r = String(m?.role ?? "")
          acc[r] = (acc[r] ?? 0) + 1
          return acc
        },
        {} as Record<string, number>
      ),
      items: params.messages.map((m) => summarizeLlmMessage(m))
    }
  )

  await ensureTvcSchema()
  const db = await getDb({ tvcStories, tvcLlmMessages })

  const [story] = await db
    .select({ id: tvcStories.id })
    .from(tvcStories)
    .where(and(eq(tvcStories.id, storyId), eq(tvcStories.userId, userId)))
    .limit(1)
  if (!story) throw new ServiceError("NOT_FOUND", "项目不存在")

  const values = params.messages.map((m, i) => {
    const role = String(m?.role ?? "").trim()
    const content = typeof m?.content === "string" ? m.content : ""
    const name = typeof m?.name === "string" ? m.name : null
    const toolCallId = typeof m?.tool_call_id === "string" ? m.tool_call_id : null
    const toolCalls = Array.isArray(m?.tool_calls) ? (m.tool_calls as any) : null
    return {
      storyId,
      seq: i,
      role,
      content,
      name,
      toolCallId,
      toolCalls
    }
  })

  await db.insert(tvcLlmMessages).values(values as any).catch((err) => {
    auditError(
      "tvc_context",
      "llm_messages_append_failed",
      "写入 llm_messages 失败",
      { traceId: runId, storyId, runId },
      { errorName: (err as any)?.name, errorMessage: (err as any)?.message }
    )
    throw err
  })

  auditDebug("tvc_context", "llm_messages_append_success", "写入 llm_messages 成功", { traceId: runId, storyId, runId }, { messageCount: values.length })
}
