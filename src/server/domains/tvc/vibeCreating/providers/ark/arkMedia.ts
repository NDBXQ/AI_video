import { readEnv, readEnvInt } from "@/shared/env"
import { ServiceError } from "@/server/shared/errors"

function normalizeArkBaseUrl(raw: string): string {
  const trimmed = (raw ?? "").trim()
  if (!trimmed) return ""
  return trimmed.replace(/\/+$/, "")
}

function getArkAuth(): { apiKey: string; baseUrl: string } {
  const apiKey = readEnv("VIBE_ARK_API_KEY")
  if (!apiKey) throw new ServiceError("ARK_NOT_CONFIGURED", "未配置火山方舟 API Key，请设置 VIBE_ARK_API_KEY")
  const baseUrl = normalizeArkBaseUrl(readEnv("VIBE_ARK_API_BASE_URL") ?? "https://ark.cn-beijing.volces.com/api/v3") || "https://ark.cn-beijing.volces.com/api/v3"
  return { apiKey, baseUrl }
}

function normalizeImageInput(image?: string | string[]): string[] {
  if (!image) return []
  const list = Array.isArray(image) ? image : [image]
  return list.map((it) => String(it ?? "").trim()).filter(Boolean)
}

export async function arkGenerateImage(params: {
  model: string
  prompt: string
  image?: string | string[]
  size?: string
  watermark?: boolean
  guidanceScale?: number
  seed?: number
  sequentialImageGeneration?: "auto"
  signal?: AbortSignal
}): Promise<{ url: string }> {
  const { apiKey, baseUrl } = getArkAuth()
  const url = `${baseUrl}/images/generations`
  const images = normalizeImageInput(params.image)
  const guidanceScale = Number.isFinite(params.guidanceScale as number) ? Number(params.guidanceScale) : 4
  const seed = Number.isFinite(params.seed as number) ? Math.trunc(Number(params.seed)) : undefined
  const sequential = params.sequentialImageGeneration ?? "auto"
  const resp = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      guidance_scale: guidanceScale,
      ...(images.length ? { image: images } : {}),
      model: params.model,
      prompt: params.prompt,
      ...(params.size ? { size: params.size } : {}),
      ...(typeof params.watermark === "boolean" ? { watermark: params.watermark } : {}),
      ...(typeof seed === "number" ? { seed } : {}),
      sequential_image_generation: sequential,
      response_format: "url"
    }),
    signal: params.signal
  })
  const json = (await resp.json().catch(() => null)) as any
  if (!resp.ok) {
    const msg = String(json?.error?.message ?? `HTTP ${resp.status}`)
    throw new ServiceError("ARK_REQUEST_FAILED", `火山方舟图片生成失败：${msg}`)
  }
  const firstUrl = String(json?.data?.[0]?.url ?? "").trim()
  if (!firstUrl) {
    const msg = String(json?.error?.message ?? "缺少图片 URL")
    throw new ServiceError("ARK_REQUEST_FAILED", `火山方舟图片生成失败：${msg}`)
  }
  return { url: firstUrl }
}

export async function arkCreateVideoTask(params: {
  model: string
  prompt: string
  firstFrameUrl?: string
  lastFrameUrl?: string
  durationSeconds: number
  resolution?: "480p" | "720p" | "1080p"
  ratio?: "16:9" | "9:16" | "1:1" | "4:3" | "3:4" | "21:9" | "adaptive"
  watermark?: boolean
  returnLastFrame?: boolean
  signal?: AbortSignal
}): Promise<{ id: string }> {
  const { apiKey, baseUrl } = getArkAuth()
  const url = `${baseUrl}/contents/generations/tasks`
  const content: any[] = [{ type: "text", text: params.prompt }]
  if (params.firstFrameUrl) content.push({ type: "image_url", image_url: { url: params.firstFrameUrl }, role: "first_frame" })
  if (params.lastFrameUrl) content.push({ type: "image_url", image_url: { url: params.lastFrameUrl }, role: "last_frame" })

  const resp = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: params.model,
      content,
      ...(typeof params.returnLastFrame === "boolean" ? { return_last_frame: params.returnLastFrame } : {}),
      ...(params.resolution ? { resolution: params.resolution } : {}),
      ...(params.ratio ? { ratio: params.ratio } : {}),
      duration: params.durationSeconds,
      ...(typeof params.watermark === "boolean" ? { watermark: params.watermark } : {})
    }),
    signal: params.signal
  })
  const json = (await resp.json().catch(() => null)) as any
  if (!resp.ok) {
    const msg = String(json?.error?.message ?? `HTTP ${resp.status}`)
    throw new ServiceError("ARK_REQUEST_FAILED", `火山方舟视频任务创建失败：${msg}`)
  }
  const id = String(json?.id ?? "").trim()
  if (!id) {
    const msg = String(json?.error?.message ?? "缺少任务 ID")
    throw new ServiceError("ARK_REQUEST_FAILED", `火山方舟视频任务创建失败：${msg}`)
  }
  return { id }
}

export async function arkGetVideoTask(params: { id: string; signal?: AbortSignal }): Promise<{
  status: string
  videoUrl?: string
  lastFrameUrl?: string
  errorMessage?: string
}> {
  const { apiKey, baseUrl } = getArkAuth()
  const url = `${baseUrl}/contents/generations/tasks/${encodeURIComponent(params.id)}`
  const resp = await fetch(url, {
    method: "GET",
    headers: { authorization: `Bearer ${apiKey}` },
    signal: params.signal
  })
  const json = (await resp.json().catch(() => null)) as any
  if (!resp.ok) {
    const msg = String(json?.error?.message ?? `HTTP ${resp.status}`)
    throw new ServiceError("ARK_REQUEST_FAILED", `火山方舟视频任务查询失败：${msg}`)
  }
  const status = String(json?.status ?? "").trim()
  const videoUrl = String(json?.content?.video_url ?? "").trim()
  const lastFrameUrl = String(json?.content?.last_frame_url ?? "").trim()
  const errorMessage = String(json?.error?.message ?? "").trim()
  return { status, ...(videoUrl ? { videoUrl } : {}), ...(lastFrameUrl ? { lastFrameUrl } : {}), ...(errorMessage ? { errorMessage } : {}) }
}

export async function arkWaitForVideoTask(params: { id: string; signal?: AbortSignal }): Promise<{ videoUrl: string; lastFrameUrl?: string }> {
  const timeoutMs = readEnvInt("VIBE_ARK_VIDEO_TASK_TIMEOUT_MS") ?? 240_000
  const intervalMs = readEnvInt("VIBE_ARK_VIDEO_TASK_POLL_MS") ?? 1500
  const startedAt = Date.now()
  while (true) {
    if (params.signal?.aborted) throw new ServiceError("VIBE_ABORTED", "请求已取消")
    if (Date.now() - startedAt > timeoutMs) throw new ServiceError("ARK_REQUEST_FAILED", "火山方舟视频任务超时")
    const task = await arkGetVideoTask({ id: params.id, signal: params.signal })
    if (task.status === "succeeded") {
      if (!task.videoUrl) throw new ServiceError("ARK_REQUEST_FAILED", "火山方舟视频任务成功但缺少 video_url")
      return { videoUrl: task.videoUrl, ...(task.lastFrameUrl ? { lastFrameUrl: task.lastFrameUrl } : {}) }
    }
    if (task.status === "failed" || task.status === "expired" || task.status === "cancelled") {
      const msg = task.errorMessage ? `：${task.errorMessage}` : ""
      throw new ServiceError("ARK_REQUEST_FAILED", `火山方舟视频任务失败${msg}`)
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
}

