import type { ApiErr, ApiOk } from "@/shared/api"

type JobStartResponse = ApiOk<{ jobId: string; status: string }> | ApiErr

type JobSnapshot = {
  jobId: string
  status: "queued" | "running" | "done" | "error"
  results: Array<{
    name: string
    category: string
    ok: boolean
    skipped?: boolean
    id?: string
    url?: string
    thumbnailUrl?: string | null
    errorMessage?: string
  }>
  summary: { total: number; ok: number; skipped: number; failed: number }
  errorMessage?: string
}

type JobSnapshotResponse = ApiOk<JobSnapshot> | ApiErr

export async function startReferenceImageJob(input: {
  storyId?: string
  storyboardId?: string
  prompts: Array<{ name: string; prompt: string; description?: string; category: "background" | "role" | "item"; generatedImageId?: string }>
  forceRegenerate?: boolean
}): Promise<string> {
  const res = await fetch("/api/video-creation/images/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, async: true })
  })
  const json = (await res.json().catch(() => null)) as JobStartResponse | null
  if (!res.ok || !json || (json as ApiErr).ok === false) {
    const errJson = (json as ApiErr | null) ?? null
    throw new Error(errJson?.error?.message ?? `HTTP ${res.status}`)
  }
  const okJson = json as ApiOk<{ jobId: string; status: string }>
  const jobId = okJson.data.jobId
  if (!jobId) throw new Error("任务创建成功但缺少 jobId")
  return jobId
}

export async function waitReferenceImageJob(jobId: string, opts?: { timeoutMs?: number }): Promise<JobSnapshot> {
  const timeoutMs = opts?.timeoutMs ?? 10 * 60 * 1000
  if (typeof window === "undefined") throw new Error("waitReferenceImageJob 只能在浏览器端调用")

  if (typeof EventSource === "undefined") {
    const startAt = Date.now()
    while (Date.now() - startAt < timeoutMs) {
      const res = await fetch(`/api/video-creation/images/generate/jobs/${encodeURIComponent(jobId)}`, { method: "GET" })
      const json = (await res.json().catch(() => null)) as JobSnapshotResponse | null
      if (res.ok && json && (json as ApiErr).ok !== false) {
        const snap = (json as ApiOk<JobSnapshot>).data
        if (snap.status === "done") return snap
        if (snap.status === "error") throw new Error(snap.errorMessage ?? "生成失败")
      }
      await new Promise((r) => setTimeout(r, 800))
    }
    throw new Error("等待生成超时")
  }

  return await new Promise<JobSnapshot>((resolve, reject) => {
    const es = new EventSource(`/api/video-creation/images/generate/jobs/${encodeURIComponent(jobId)}/events`)
    const timer = window.setTimeout(() => {
      es.close()
      reject(new Error("等待生成超时"))
    }, timeoutMs)

    const cleanup = () => {
      window.clearTimeout(timer)
      es.close()
    }

    es.onmessage = (ev) => {
      try {
        const json = JSON.parse(ev.data) as JobSnapshotResponse
        if (!json || (json as ApiErr).ok === false) return
        const snap = (json as ApiOk<JobSnapshot>).data
        if (!snap) return
        if (snap.status === "done") {
          cleanup()
          resolve(snap)
        } else if (snap.status === "error") {
          cleanup()
          reject(new Error(snap.errorMessage ?? "生成失败"))
        }
      } catch {
      }
    }

    es.onerror = () => {
      cleanup()
      reject(new Error("回调连接失败"))
    }
  })
}

