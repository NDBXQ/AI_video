import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { sql } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { getTraceId } from "@/shared/trace"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { logger } from "@/shared/logger"
import { telemetryEvents } from "@/shared/schema"
import { ensureTelemetryTable } from "@/server/db/ensureTelemetryTable"

export const runtime = "nodejs"

const querySchema = z.object({
  hours: z.string().trim().optional()
})

export async function GET(req: NextRequest): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const start = Date.now()

  const url = new URL(req.url)
  const parsedQuery = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()))
  if (!parsedQuery.success) {
    return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "请求参数不正确"), { status: 400 })
  }

  const hours = Math.max(1, Math.min(24 * 30, Number(parsedQuery.data.hours ?? "24") || 24))

  try {
    await ensureTelemetryTable()
    const db = await getDb({ telemetryEvents })

    const byEvent = await db.execute(sql`
      select event as name, count(distinct trace_id) as uv
      from telemetry_events
      where page = '/tvc'
        and created_at >= now() - (${hours}::text || ' hours')::interval
      group by event
    `)

    const counts: Record<string, number> = {}
    for (const row of (byEvent.rows ?? []) as Array<{ name: string; uv: unknown }>) {
      const n = typeof row.uv === "number" ? row.uv : Number(row.uv ?? 0)
      counts[row.name] = Number.isFinite(n) ? n : 0
    }

    const opens = counts.tvc_open ?? 0
    const generates = counts.tvc_generate_shotlist_clicked ?? 0
    const chats = counts.tvc_chat_submitted ?? 0

    const rate = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 10000) / 100 : 0)

    logger.info({
      event: "telemetry_tvc_funnel_success",
      module: "telemetry",
      traceId,
      message: "TVC 漏斗统计成功",
      hours,
      durationMs: Date.now() - start
    })

    return NextResponse.json(
      makeApiOk(traceId, {
        windowHours: hours,
        counts: {
          tvc_open: opens,
          tvc_generate_shotlist_clicked: generates,
          tvc_chat_submitted: chats
        },
        rates: {
          generateRate: rate(generates, opens),
          chatRate: rate(chats, opens)
        },
        updatedAt: new Date().toISOString()
      }),
      { status: 200 }
    )
  } catch (err) {
    const anyErr = err as { name?: string; message?: string; stack?: string }
    logger.error({
      event: "telemetry_tvc_funnel_failed",
      module: "telemetry",
      traceId,
      message: "TVC 漏斗统计失败",
      errorName: anyErr?.name,
      errorMessage: anyErr?.message,
      stack: anyErr?.stack,
      durationMs: Date.now() - start
    })
    return NextResponse.json(makeApiErr(traceId, "TELEMETRY_REPORT_FAILED", "统计失败"), { status: 500 })
  }
}
