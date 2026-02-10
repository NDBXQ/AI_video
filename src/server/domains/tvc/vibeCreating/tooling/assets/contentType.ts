export function getImageFileExt(contentType: string): string {
  const ct = (contentType ?? "").toLowerCase()
  if (ct.includes("png")) return "png"
  if (ct.includes("webp")) return "webp"
  if (ct.includes("gif")) return "gif"
  return "jpg"
}

export function getVideoFileExt(contentType: string): string {
  const ct = (contentType ?? "").toLowerCase()
  if (ct.includes("webm")) return "webm"
  if (ct.includes("quicktime")) return "mov"
  if (ct.includes("mp4")) return "mp4"
  return "mp4"
}
