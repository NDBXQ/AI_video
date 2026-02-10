import { ensureTvcSchema } from "@/server/db/ensureTvcSchema"
import { ServiceError } from "@/server/shared/errors"
import { tvcAssets, tvcStories } from "@/shared/schema/tvc"
import { and, eq } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { auditDebug, auditError } from "@/shared/logAudit"

function stripTags(text: string): string {
  return String(text ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/\r\n/g, "\n")
    .trim()
}

function extractTopLevelItems(xml: string): string[] {
  const s = String(xml ?? "")
  const out: string[] = []
  const OPEN = "<item>"
  const CLOSE = "</item>"
  let i = 0
  let depth = 0
  let start = -1
  while (i < s.length) {
    const nextOpen = s.indexOf(OPEN, i)
    const nextClose = s.indexOf(CLOSE, i)
    if (nextOpen < 0 && nextClose < 0) break
    if (nextOpen >= 0 && (nextClose < 0 || nextOpen < nextClose)) {
      depth += 1
      if (depth === 1) start = nextOpen + OPEN.length
      i = nextOpen + OPEN.length
      continue
    }
    if (nextClose >= 0) {
      if (depth === 1 && start >= 0) out.push(s.slice(start, nextClose))
      depth = Math.max(0, depth - 1)
      i = nextClose + CLOSE.length
      continue
    }
    break
  }
  return out.map((x) => x.trim()).filter(Boolean)
}

function parseFieldsFromItem(itemXml: string): Record<string, string> {
  const record: Record<string, string> = {}
  const re = /<field\s+name="([^"]+)"\s*>([\s\S]*?)<\/field>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(itemXml))) {
    const k = String(m[1] ?? "").trim()
    const v = stripTags(m[2] ?? "")
    if (!k || !v) continue
    record[k] = v
  }
  return record
}

export function parseStoryboardsXml(xml: string): Array<Record<string, string>> {
  const raw = String(xml ?? "").trim()
  if (!raw) return []
  const items = extractTopLevelItems(raw)
  return items.map(parseFieldsFromItem).filter((r) => Object.keys(r).length > 0)
}

export async function persistStoryboardsAsset(params: { traceId: string; storyId: string; userId: string; storyboardsXml: string }): Promise<void> {
  const traceId = String(params.traceId ?? "").trim()
  const storyId = String(params.storyId ?? "").trim()
  const userId = String(params.userId ?? "").trim()
  const storyboardsXml = String(params.storyboardsXml ?? "")
  if (!traceId || !storyId || !userId) throw new ServiceError("VALIDATION_FAILED", "缺少 traceId/storyId/userId")
  if (!storyboardsXml.trim()) return

  await ensureTvcSchema()
  const db = await getDb({ tvcStories, tvcAssets })

  const [story] = await db
    .select({ id: tvcStories.id })
    .from(tvcStories)
    .where(and(eq(tvcStories.id, storyId), eq(tvcStories.userId, userId)))
    .limit(1)
  if (!story) throw new ServiceError("NOT_FOUND", "项目不存在")

  const kind = "storyboards"
  const assetOrdinal = 1
  const storageKey = `inline/storyboards/${traceId}.xml`
  const storyboards = parseStoryboardsXml(storyboardsXml)
  const meta: Record<string, unknown> = { type: "storyboards", storyboardsXml: storyboardsXml, storyboards, traceId, storyId }

  auditDebug("tvc_context", "storyboards_persist_start", "准备写入分镜结构化结果", { traceId, storyId, runId: traceId }, { bytes: storyboardsXml.length })
  const insert = db.insert(tvcAssets).values({ storyId, kind, assetOrdinal, storageKey, mimeType: "application/xml", meta } as any)
  await insert
    .onConflictDoUpdate({
      target: [tvcAssets.storyId, tvcAssets.kind, tvcAssets.assetOrdinal],
      set: { storageKey, mimeType: "application/xml", meta, updatedAt: new Date() } as any
    })
    .catch((err) => {
      auditError(
        "tvc_context",
        "storyboards_persist_failed",
        "写入分镜结构化结果失败",
        { traceId, storyId, runId: traceId },
        { errorName: (err as any)?.name, errorMessage: (err as any)?.message }
      )
      throw err
    })
  auditDebug("tvc_context", "storyboards_persist_success", "写入分镜结构化结果成功", { traceId, storyId, runId: traceId }, { storageKey, assetOrdinal })
}
