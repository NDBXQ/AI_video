import { ensureTvcSchema } from "@/server/db/ensureTvcSchema"
import { ServiceError } from "@/server/shared/errors"
import { tvcAssets, tvcStories } from "@/shared/schema/tvc"
import { and, eq } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { auditDebug, auditError } from "@/shared/logAudit"

export async function persistClarificationAsset(params: {
  traceId: string
  storyId: string
  userId: string
  markdown: string
}): Promise<void> {
  const traceId = String(params.traceId ?? "").trim()
  const storyId = String(params.storyId ?? "").trim()
  const userId = String(params.userId ?? "").trim()
  const markdown = String(params.markdown ?? "")
  if (!traceId || !storyId || !userId) throw new ServiceError("VALIDATION_FAILED", "缺少 traceId/storyId/userId")
  if (!markdown.trim()) return

  await ensureTvcSchema()
  const db = await getDb({ tvcStories, tvcAssets })

  const [story] = await db
    .select({ id: tvcStories.id })
    .from(tvcStories)
    .where(and(eq(tvcStories.id, storyId), eq(tvcStories.userId, userId)))
    .limit(1)
  if (!story) throw new ServiceError("NOT_FOUND", "项目不存在")

  const storageKey = `inline/clarification/${traceId}.md`
  const meta: Record<string, unknown> = {
    type: "clarification",
    markdown,
    traceId,
    storyId
  }

  auditDebug("tvc_context", "clarification_persist_start", "准备写入澄清结果", { traceId, storyId, runId: traceId }, { bytes: markdown.length })
  await db
    .insert(tvcAssets)
    .values({ storyId, kind: "clarification", assetOrdinal: 0, storageKey, mimeType: "text/markdown", meta } as any)
    .catch((err) => {
      auditError(
        "tvc_context",
        "clarification_persist_failed",
        "写入澄清结果失败",
        { traceId, storyId, runId: traceId },
        { errorName: (err as any)?.name, errorMessage: (err as any)?.message }
      )
      throw err
    })
  auditDebug("tvc_context", "clarification_persist_success", "写入澄清结果成功", { traceId, storyId, runId: traceId }, { storageKey })
}
