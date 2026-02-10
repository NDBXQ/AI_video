import { NextResponse, type NextRequest } from "next/server"
import { getSessionFromRequest } from "@/shared/session"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { getTraceId } from "@/shared/trace"
import { getJobById } from "@/server/framework/jobs/jobDb"
import { getTvcJobById } from "@/server/domains/tvc/jobs/tvcJobDb"
import { kickAllWorkers } from "@/server/framework/jobs/kickWorkers"

export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const session = await getSessionFromRequest(req)
  const userId = session?.userId
  if (!userId) return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), { status: 401 })

  const { jobId } = await params
  kickAllWorkers()
  const initial = (await getJobById(jobId)) ?? (await getTvcJobById(jobId))
  if (!initial) return NextResponse.json(makeApiErr(traceId, "NOT_FOUND", "任务不存在或已过期"), { status: 404 })
  if (initial.userId !== userId) return NextResponse.json(makeApiErr(traceId, "FORBIDDEN", "无权限访问该任务"), { status: 403 })

  const encoder = new TextEncoder()
  let closed = false

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (data: unknown, id?: number) => {
        if (closed) return
        const idLine = typeof id === "number" ? `id: ${id}\n` : ""
        controller.enqueue(encoder.encode(`${idLine}data: ${JSON.stringify(data)}\n\n`))
      }

      controller.enqueue(encoder.encode("retry: 2000\n\n"))
      const lastEventIdRaw = req.headers.get("last-event-id") ?? ""
      const lastEventId = Number(lastEventIdRaw)
      let lastVersion = Number.isFinite(lastEventId) && lastEventId > 0 ? Math.max(lastEventId, 0) : initial.progressVersion

      send(makeApiOk(traceId, { jobId, type: initial.type, status: initial.status, snapshot: initial.snapshot }), initial.progressVersion)
      if (initial.status === "done" || initial.status === "error") {
        closed = true
        controller.close()
        return
      }

      const tick = async () => {
        let lastPingAt = Date.now()
        while (!closed && !req.signal.aborted) {
          await new Promise((r) => setTimeout(r, 1000))
          const now = Date.now()
          if (now - lastPingAt >= 15000) {
            lastPingAt = now
            controller.enqueue(encoder.encode(`: ping ${now}\n\n`))
          }
          try {
            const row = (await getJobById(jobId)) ?? (await getTvcJobById(jobId))
            if (!row) continue
            if (row.userId !== userId) continue
            if (row.progressVersion === lastVersion) {
              if (row.status === "done" || row.status === "error") {
                closed = true
                controller.close()
                return
              }
              continue
            }
            lastVersion = row.progressVersion
            send(makeApiOk(traceId, { jobId, type: row.type, status: row.status, snapshot: row.snapshot }), row.progressVersion)
            if (row.status === "done" || row.status === "error") {
              closed = true
              controller.close()
              return
            }
          } catch {
            await new Promise((r) => setTimeout(r, 2000))
          }
        }
      }
      void tick()

      const abort = () => {
        if (closed) return
        closed = true
        controller.close()
      }

      req.signal.addEventListener("abort", abort)
    }
  })

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  })
}
