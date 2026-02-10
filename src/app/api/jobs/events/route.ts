import { NextResponse, type NextRequest } from "next/server"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { getSessionFromRequest } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { kickAllWorkers } from "@/server/framework/jobs/kickWorkers"
import { listJobsByStory } from "@/server/framework/jobs/jobDb"

type JobStatus = "queued" | "running" | "done" | "error"
type ActiveJob = { jobId: string; type: string; status: JobStatus; progressVersion: number; snapshot: Record<string, unknown> }

function summaryOf(list: ActiveJob[]): { queued: number; running: number; total: number } {
  const queued = list.filter((j) => j.status === "queued").length
  const running = list.filter((j) => j.status === "running").length
  return { queued, running, total: list.length }
}

function computeSignature(list: ActiveJob[]): string {
  if (!Array.isArray(list) || list.length === 0) return ""
  const sorted = [...list].sort((a, b) => String(a.jobId).localeCompare(String(b.jobId)))
  return sorted
    .map((j) => {
      const stage = typeof (j.snapshot as any)?.stage === "string" ? String((j.snapshot as any).stage) : ""
      return `${j.jobId}:${j.status}:${j.progressVersion}:${stage}`
    })
    .join("|")
}

export async function GET(req: NextRequest): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const session = await getSessionFromRequest(req)
  const userId = session?.userId
  if (!userId) return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), { status: 401 })

  const { searchParams } = new URL(req.url)
  const storyId = (searchParams.get("storyId") ?? "").trim()
  if (!storyId) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "缺少 storyId"), { status: 400 })

  const activeOnly = searchParams.get("activeOnly") !== "false"
  const limitRaw = Number(searchParams.get("limit") ?? "20")
  const limit = Number.isFinite(limitRaw) ? Math.min(50, Math.max(1, Math.floor(limitRaw))) : 20

  const encoder = new TextEncoder()
  let closed = false
  let eventId = Date.now()
  let lastSignature = ""
  let lastKickAt = 0

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (data: unknown) => {
        if (closed) return
        eventId += 1
        controller.enqueue(encoder.encode(`id: ${eventId}\n`))
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      controller.enqueue(encoder.encode("retry: 2000\n\n"))

      const tick = async () => {
        let lastPingAt = Date.now()
        try {
          kickAllWorkers()
        } catch {}

        while (!closed && !req.signal.aborted) {
          const now = Date.now()
          if (now - lastPingAt >= 15000) {
            lastPingAt = now
            controller.enqueue(encoder.encode(`: ping ${now}\n\n`))
          }

          const jobs = await listJobsByStory({ userId, storyId, activeOnly, limit })
          const sig = computeSignature(jobs)
          if (sig !== lastSignature) {
            lastSignature = sig
            send(makeApiOk(traceId, { kind: "jobs_snapshot", storyId, jobs, summary: summaryOf(jobs) }))
          }

          const hasActive = jobs.some((j) => j.status === "queued" || j.status === "running")
          if (hasActive && now - lastKickAt >= 12000) {
            lastKickAt = now
            try {
              kickAllWorkers()
            } catch {}
          }

          await new Promise((r) => setTimeout(r, hasActive ? 1000 : 5000))
        }
      }

      void tick().catch(() => {
        if (closed) return
        closed = true
        controller.close()
      })

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
