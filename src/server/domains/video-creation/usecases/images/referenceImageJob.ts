import { getJobSnapshot } from "@/server/domains/video-creation/jobs/referenceImageDbQueue"
import { kickReferenceImageWorker } from "@/server/domains/video-creation/jobs/referenceImageWorker"
import { makeApiOk } from "@/shared/api"

export async function getReferenceImageJob(input: {
  traceId: string
  userId: string
  jobId: string
}): Promise<
  | { ok: true; snapshot: unknown }
  | { ok: false; code: string; message: string; status: number }
> {
  kickReferenceImageWorker()
  const row = await getJobSnapshot(input.jobId)
  if (!row) return { ok: false, code: "NOT_FOUND", message: "任务不存在或已过期", status: 404 }
  if (row.userId !== input.userId) return { ok: false, code: "FORBIDDEN", message: "无权限访问该任务", status: 403 }
  return { ok: true, snapshot: row.snapshot }
}

export async function createReferenceImageJobEventsStream(input: {
  traceId: string
  userId: string
  jobId: string
  signal: AbortSignal
}): Promise<
  | { ok: true; stream: ReadableStream<Uint8Array> }
  | { ok: false; code: string; message: string; status: number }
> {
  kickReferenceImageWorker()
  const initial = await getJobSnapshot(input.jobId)
  if (!initial) return { ok: false, code: "NOT_FOUND", message: "任务不存在或已过期", status: 404 }
  if (initial.userId !== input.userId) return { ok: false, code: "FORBIDDEN", message: "无权限访问该任务", status: 403 }

  const encoder = new TextEncoder()
  let closed = false

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (data: unknown) => {
        if (closed) return
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      let lastVersion = initial.progressVersion
      send(makeApiOk(input.traceId, initial.snapshot))
      if (initial.snapshot.status === "done" || initial.snapshot.status === "error") {
        closed = true
        controller.close()
        return
      }

      const tick = async () => {
        while (!closed && !input.signal.aborted) {
          await new Promise((r) => setTimeout(r, 800))
          const row = await getJobSnapshot(input.jobId)
          if (!row) continue
          if (row.userId !== input.userId) continue
          if (row.progressVersion === lastVersion) {
            if (row.snapshot.status === "done" || row.snapshot.status === "error") {
              closed = true
              controller.close()
              return
            }
            continue
          }
          lastVersion = row.progressVersion
          send(makeApiOk(input.traceId, row.snapshot))
          if (row.snapshot.status === "done" || row.snapshot.status === "error") {
            closed = true
            controller.close()
            return
          }
        }
      }
      void tick()

      const abort = () => {
        if (closed) return
        closed = true
        controller.close()
      }

      input.signal.addEventListener("abort", abort)
    }
  })

  return { ok: true, stream }
}
