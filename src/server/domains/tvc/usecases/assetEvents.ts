import { and, asc, eq, gt, or, sql } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { tvcAssets, tvcStories } from "@/shared/schema/tvc"
import { ensureTvcSchema } from "@/server/db/ensureTvcSchema"
import { formatSseCursor, getSseCursorFromRequest, sleepWithAbort } from "@/shared/sse"

export async function createTvcAssetEventsStream(input: {
  traceId: string
  userId: string
  storyId: string
  cursor?: string
  req: Request
}): Promise<
  | { ok: true; stream: ReadableStream<Uint8Array> }
  | { ok: false; code: string; message: string; status: number }
> {
  await ensureTvcSchema()

  const db = await getDb({ tvcStories, tvcAssets })
  const [story] = await db.select({ id: tvcStories.id, userId: tvcStories.userId }).from(tvcStories).where(eq(tvcStories.id, input.storyId)).limit(1)
  if (!story || story.userId !== input.userId) return { ok: false, code: "NOT_FOUND", message: "项目不存在", status: 404 }

  const seedFromNow = !(input.req.headers.get("last-event-id") ?? "").trim() && !String(input.cursor ?? "").trim()
  const seedCursor = seedFromNow ? `${Date.now()}:` : input.cursor
  const initialCursor = getSseCursorFromRequest(input.req, seedCursor)
  let cursorMs = initialCursor.ms
  let cursorId = initialCursor.id
  const updatedAtMsExpr = sql<number>`cast(floor(extract(epoch from ${tvcAssets.updatedAt}) * 1000) as bigint)`

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (chunk: string) => controller.enqueue(encoder.encode(chunk))
      send(`: traceId=${input.traceId}\n\n`)

      const signal = input.req.signal
      let lastKeepaliveAt = Date.now()

      while (!signal.aborted) {
        const rows = await db
          .select({
            id: tvcAssets.id,
            kind: tvcAssets.kind,
            assetOrdinal: tvcAssets.assetOrdinal,
            updatedAt: tvcAssets.updatedAt
          })
          .from(tvcAssets)
          .where(
            cursorMs > 0
              ? and(eq(tvcAssets.storyId, input.storyId), or(gt(updatedAtMsExpr, cursorMs), and(eq(updatedAtMsExpr, cursorMs), gt(tvcAssets.id, cursorId))))
              : eq(tvcAssets.storyId, input.storyId)
          )
          .orderBy(asc(updatedAtMsExpr), asc(tvcAssets.id))
          .limit(50)

        if (rows.length > 0) {
          for (const r of rows) {
            const ordinalRaw = Number(r.assetOrdinal)
            const ordinal = Number.isFinite(ordinalRaw) ? Math.trunc(ordinalRaw) : 0
            if (!ordinal || ordinal <= 0) continue
            const updatedAt = r.updatedAt instanceof Date ? r.updatedAt : new Date()
            const nextCursor = formatSseCursor(updatedAt, String(r.id ?? ""))
            const payload = JSON.stringify({ kind: String(r.kind ?? ""), ordinal, status: "生成成功" })
            send(`id: ${nextCursor}\n`)
            send(`event: asset\n`)
            send(`data: ${payload}\n\n`)
            cursorMs = updatedAt.getTime()
            cursorId = String(r.id ?? "")
          }
          lastKeepaliveAt = Date.now()
          continue
        }

        if (Date.now() - lastKeepaliveAt > 15000) {
          send(`: keepalive ${Date.now()}\n\n`)
          lastKeepaliveAt = Date.now()
        }

        await sleepWithAbort(1000, signal)
      }
      controller.close()
    }
  })

  return { ok: true, stream }
}
