import { ServiceError } from "@/server/shared/errors"

export async function fetchImageBuffer(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  const resp = await fetch(url)
  if (!resp.ok) throw new ServiceError("ASSET_DOWNLOAD_FAILED", `下载图片失败：HTTP ${resp.status}`)
  const contentType = (resp.headers.get("content-type") ?? "image/jpeg").trim()
  const ab = await resp.arrayBuffer()
  return { buffer: Buffer.from(ab), contentType }
}

export async function fetchBinaryBuffer(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  const resp = await fetch(url)
  if (!resp.ok) throw new ServiceError("ASSET_DOWNLOAD_FAILED", `下载资源失败：HTTP ${resp.status}`)
  const contentType = (resp.headers.get("content-type") ?? "application/octet-stream").trim()
  const ab = await resp.arrayBuffer()
  return { buffer: Buffer.from(ab), contentType }
}
