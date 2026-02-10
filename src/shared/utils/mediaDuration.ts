export type MediaKind = "audio" | "video"

function createMediaElement(kind: MediaKind): HTMLMediaElement {
  return kind === "audio" ? document.createElement("audio") : document.createElement("video")
}

async function getMediaDurationMsFromUrl(url: string, kind: MediaKind): Promise<number | null> {
  if (typeof document === "undefined") return null
  const src = url.trim()
  if (!src) return null

  const el = createMediaElement(kind)
  el.preload = "metadata"

  try {
    const durationSeconds = await new Promise<number>((resolve, reject) => {
      const onLoaded = () => resolve(el.duration)
      const onError = () => reject(new Error("MEDIA_METADATA_LOAD_FAILED"))

      el.addEventListener("loadedmetadata", onLoaded, { once: true })
      el.addEventListener("error", onError, { once: true })
      el.src = src
    })

    if (Number.isFinite(durationSeconds) && durationSeconds > 0) return Math.round(durationSeconds * 1000)
    if (durationSeconds === Number.POSITIVE_INFINITY) {
      const resolvedSeconds = await new Promise<number>((resolve, reject) => {
        const onTimeUpdate = () => resolve(el.duration)
        const onDurationChange = () => resolve(el.duration)
        const onError = () => reject(new Error("MEDIA_METADATA_LOAD_FAILED"))

        el.addEventListener("timeupdate", onTimeUpdate, { once: true })
        el.addEventListener("durationchange", onDurationChange, { once: true })
        el.addEventListener("error", onError, { once: true })
        try {
          el.currentTime = 1e101
        } catch {
          resolve(el.duration)
        }
      })
      if (Number.isFinite(resolvedSeconds) && resolvedSeconds > 0) return Math.round(resolvedSeconds * 1000)
    }

    return null
  } catch {
    return null
  } finally {
    el.src = ""
  }
}

export async function getMediaDurationMsFromFile(file: File, kind: MediaKind): Promise<number | null> {
  if (typeof URL === "undefined") return null
  const objUrl = URL.createObjectURL(file)
  try {
    return await getMediaDurationMsFromUrl(objUrl, kind)
  } finally {
    URL.revokeObjectURL(objUrl)
  }
}

