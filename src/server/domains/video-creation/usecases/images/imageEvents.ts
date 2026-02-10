import { and, asc, eq, gt, isNull, or } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { generatedImages } from "@/shared/schema/generation"
import { stories } from "@/shared/schema/story"
import { formatSseCursor, getSseCursorFromRequest, sleepWithAbort } from "@/shared/sse"

export async function createVideoCreationImageEventsStream(input: {
  traceId: string
  userId: string
  storyId: string
  storyboardId?: string
  includeGlobal: boolean
  cursor?: string
  req: Request
}): Promise<
  | { ok: true; stream: ReadableStream<Uint8Array> }
  | { ok: false; code: string; message: string; status: number }
> {
  const db = await getDb({ generatedImages, stories })
  const [story] = await db
    .select({ id: stories.id })
    .from(stories)
    .where(and(eq(stories.id, input.storyId), eq(stories.userId, input.userId)))
    .limit(1)
  if (!story) return { ok: false, code: "NOT_FOUND", message: "未找到可用的故事", status: 404 }

  const seedFromNow = !(input.req.headers.get("last-event-id") ?? "").trim() && !String(input.cursor ?? "").trim()
  const seedCursor = seedFromNow ? `${Date.now()}:` : input.cursor
  const initialCursor = getSseCursorFromRequest(input.req, seedCursor)
  let cursorMs = initialCursor.ms
  let cursorId = initialCursor.id

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (chunk: string) => controller.enqueue(encoder.encode(chunk))
      send(`: traceId=${input.traceId}\n\n`)

      const signal = input.req.signal
      let lastKeepaliveAt = Date.now()

      while (!signal.aborted) {
        const cursorDate = cursorMs > 0 ? new Date(cursorMs) : null
        const conditions = [eq(generatedImages.storyId, input.storyId)]

        const storyboardId = input.storyboardId
        if (storyboardId) {
          const match = eq(generatedImages.storyboardId, storyboardId)
          const cond = input.includeGlobal ? or(match, isNull(generatedImages.storyboardId)) : match
          if (cond) conditions.push(cond)
        }

        const rows = await db
          .select({
            id: generatedImages.id,
            storyboardId: generatedImages.storyboardId,
            name: generatedImages.name,
            category: generatedImages.category,
            createdAt: generatedImages.createdAt
          })
          .from(generatedImages)
          .where(
            cursorDate
              ? and(
                  ...conditions,
                  or(gt(generatedImages.createdAt, cursorDate), and(eq(generatedImages.createdAt, cursorDate), gt(generatedImages.id, cursorId)))
                )
              : and(...conditions)
          )
          .orderBy(asc(generatedImages.createdAt), asc(generatedImages.id))
          .limit(50)

        if (rows.length > 0) {
          for (const r of rows) {
            const createdAt = r.createdAt instanceof Date ? r.createdAt : new Date()
            const nextCursor = formatSseCursor(createdAt, String(r.id ?? ""))
            const payload = JSON.stringify({
              id: String(r.id ?? ""),
              storyboardId: typeof r.storyboardId === "string" ? r.storyboardId : null,
              category: String(r.category ?? ""),
              name: String(r.name ?? ""),
              status: "生成成功"
            })
            send(`id: ${nextCursor}\n`)
            send(`event: image\n`)
            send(`data: ${payload}\n\n`)
            cursorMs = createdAt.getTime()
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
