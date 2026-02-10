import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { and, asc, eq, gt, or } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { makeApiErr } from "@/shared/api"
import { getSessionFromRequest } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { stories, storyOutlines, storyboards } from "@/shared/schema"
import { formatSseCursor, getSseCursorFromRequest, sleepWithAbort } from "@/shared/sse"

export const runtime = "nodejs"

const querySchema = z.object({
  storyId: z.string().trim().min(1).max(200),
  cursor: z.string().trim().optional()
})

function normalizeUrlField(v: unknown): string {
  const s = typeof v === "string" ? v.trim() : ""
  return s
}

function getAssetHash(row: { frames: unknown; videoInfo: unknown }): string {
  const frames = (row.frames && typeof row.frames === "object" && !Array.isArray(row.frames) ? (row.frames as any) : null) as any
  const videoInfo = (row.videoInfo && typeof row.videoInfo === "object" && !Array.isArray(row.videoInfo) ? (row.videoInfo as any) : null) as any
  const firstUrl = normalizeUrlField(frames?.first?.url)
  const lastUrl = normalizeUrlField(frames?.last?.url)
  const firstThumb = normalizeUrlField(frames?.first?.thumbnailUrl)
  const lastThumb = normalizeUrlField(frames?.last?.thumbnailUrl)
  const videoUrl = normalizeUrlField(videoInfo?.url)
  return [firstUrl, lastUrl, firstThumb, lastThumb, videoUrl].join("|")
}

export async function GET(req: NextRequest): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const session = await getSessionFromRequest(req)
  const userId = session?.userId
  if (!userId) return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), { status: 401 })

  const url = new URL(req.url)
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()))
  if (!parsed.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })

  const db = await getDb({ stories, storyOutlines, storyboards })
  const storyId = parsed.data.storyId
  const [story] = await db.select({ id: stories.id }).from(stories).where(and(eq(stories.id, storyId), eq(stories.userId, userId))).limit(1)
  if (!story) return NextResponse.json(makeApiErr(traceId, "NOT_FOUND", "未找到可用的故事"), { status: 404 })

  const seedFromNow = !(req.headers.get("last-event-id") ?? "").trim() && !String(parsed.data.cursor ?? "").trim()
  const seedCursor = seedFromNow ? `${Date.now()}:` : parsed.data.cursor
  const initialCursor = getSseCursorFromRequest(req, seedCursor)
  let cursorMs = initialCursor.ms
  let cursorId = initialCursor.id
  const lastAssetHashByStoryboardId = new Map<string, string>()

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (chunk: string) => controller.enqueue(encoder.encode(chunk))
      send(`: traceId=${traceId}\n\n`)

      const signal = req.signal
      let lastKeepaliveAt = Date.now()

      while (!signal.aborted) {
        const cursorDate = cursorMs > 0 ? new Date(cursorMs) : null
        const rows = await db
          .select({
            storyboardId: storyboards.id,
            outlineId: storyboards.outlineId,
            updatedAt: storyboards.updatedAt,
            frames: storyboards.frames,
            videoInfo: storyboards.videoInfo
          })
          .from(storyboards)
          .innerJoin(storyOutlines, eq(storyboards.outlineId, storyOutlines.id))
          .where(
            cursorDate
              ? and(
                  eq(storyOutlines.storyId, storyId),
                  or(gt(storyboards.updatedAt, cursorDate), and(eq(storyboards.updatedAt, cursorDate), gt(storyboards.id, cursorId)))
                )
              : eq(storyOutlines.storyId, storyId)
          )
          .orderBy(asc(storyboards.updatedAt), asc(storyboards.id))
          .limit(50)

        if (rows.length > 0) {
          for (const r of rows) {
            const updatedAt = r.updatedAt instanceof Date ? r.updatedAt : new Date()
            const nextCursor = formatSseCursor(updatedAt, String(r.storyboardId ?? ""))
            const storyboardIdStr = String(r.storyboardId ?? "")
            if (!storyboardIdStr) continue

            const assetHash = getAssetHash({ frames: r.frames, videoInfo: r.videoInfo })
            const lastHash = lastAssetHashByStoryboardId.get(storyboardIdStr) ?? ""
            if (assetHash && assetHash === lastHash) {
              cursorMs = updatedAt.getTime()
              cursorId = storyboardIdStr
              continue
            }
            if (assetHash) lastAssetHashByStoryboardId.set(storyboardIdStr, assetHash)

            const hasAnyAsset =
              assetHash.split("|").some((v) => Boolean(String(v ?? "").trim()))
            if (!hasAnyAsset) {
              cursorMs = updatedAt.getTime()
              cursorId = storyboardIdStr
              continue
            }
            const payload = JSON.stringify({
              id: storyboardIdStr,
              outlineId: String(r.outlineId ?? ""),
              status: "生成成功"
            })
            send(`id: ${nextCursor}\n`)
            send(`event: storyboard\n`)
            send(`data: ${payload}\n\n`)
            cursorMs = updatedAt.getTime()
            cursorId = storyboardIdStr
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

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive"
    }
  })
}
