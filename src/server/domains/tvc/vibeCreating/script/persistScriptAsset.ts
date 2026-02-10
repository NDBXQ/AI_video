import { ensureTvcSchema } from "@/server/db/ensureTvcSchema"
import { ServiceError } from "@/server/shared/errors"
import { tvcAssets, tvcStories } from "@/shared/schema/tvc"
import { and, eq } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { auditDebug, auditError } from "@/shared/logAudit"

export async function persistScriptAsset(params: {
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

  const assetOrdinal = 1
  const kind = "script"
  const storageKey = `inline/script/${traceId}.md`
  const meta: Record<string, unknown> = {
    type: "script",
    markdown,
    traceId,
    storyId
  }

  auditDebug("tvc_context", "script_persist_start", "准备写入剧本 markdown", { traceId, storyId, runId: traceId }, { bytes: markdown.length })
  const insert = db.insert(tvcAssets).values({ storyId, kind, assetOrdinal, storageKey, mimeType: "text/markdown", meta } as any)
  await insert
    .onConflictDoUpdate({
      target: [tvcAssets.storyId, tvcAssets.kind, tvcAssets.assetOrdinal],
      set: { storageKey, mimeType: "text/markdown", meta, updatedAt: new Date() } as any
    })
    .catch((err) => {
      auditError(
        "tvc_context",
        "script_persist_failed",
        "写入剧本 markdown 失败",
        { traceId, storyId, runId: traceId },
        { errorName: (err as any)?.name, errorMessage: (err as any)?.message }
      )
      throw err
    })
  auditDebug("tvc_context", "script_persist_success", "写入剧本 markdown 成功", { traceId, storyId, runId: traceId }, { storageKey, assetOrdinal })
}
