import "server-only"

import { logger } from "@/shared/logger"

export async function downloadBinary(url: string, traceId: string, timeoutMs: number): Promise<{ buffer: Buffer; contentType: string | null }> {
  const startedAt = Date.now()
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null
  const t = controller ? setTimeout(() => controller.abort(), timeoutMs) : null
  try {
    const res = await fetch(url, { cache: "no-store", signal: controller?.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const ct = res.headers.get("content-type")
    const ab = await res.arrayBuffer()
    return { buffer: Buffer.from(ab), contentType: ct }
  } catch (err) {
    const durationMs = Date.now() - startedAt
    const anyErr = err as { name?: string; message?: string }
    logger.error({
      event: "download_binary_failed",
      module: "tts",
      traceId,
      message: "下载二进制文件失败",
      durationMs,
      errorName: anyErr?.name,
      errorMessage: anyErr?.message
    })
    throw err
  } finally {
    if (t) clearTimeout(t)
  }
}
