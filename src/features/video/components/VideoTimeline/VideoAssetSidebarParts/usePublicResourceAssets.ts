import { useCallback, useEffect, useRef, useState } from "react"
import type { AudioAsset, VideoAsset } from "@/shared/utils/timelineUtils"

function normalizeDurationMs(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n)
}

function createMediaElement(type: "audio" | "video"): HTMLMediaElement {
  return type === "audio" ? document.createElement("audio") : document.createElement("video")
}

async function getMediaDurationMsFromUrl(src: string, type: "audio" | "video"): Promise<number | null> {
  if (typeof document === "undefined") return null
  const url = src.trim()
  if (!url) return null

  const el = createMediaElement(type)
  el.preload = "metadata"

  try {
    const durationSeconds = await new Promise<number>((resolve, reject) => {
      const onLoaded = () => resolve(el.duration)
      const onError = () => reject(new Error("MEDIA_METADATA_LOAD_FAILED"))

      el.addEventListener("loadedmetadata", onLoaded, { once: true })
      el.addEventListener("error", onError, { once: true })
      el.src = url
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

async function getMediaDurationMsFromFile(file: File, type: "audio" | "video"): Promise<number | null> {
  if (typeof URL === "undefined") return null
  const objUrl = URL.createObjectURL(file)
  try {
    return await getMediaDurationMsFromUrl(objUrl, type)
  } finally {
    URL.revokeObjectURL(objUrl)
  }
}

async function persistPublicResourceDurationMs(id: string, durationMs: number): Promise<void> {
  await fetch("/api/library/public-resources/update-duration", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, durationMs })
  })
}

export function usePublicResourceAssets(): {
  audioAssets: AudioAsset[]
  videoLibraryAssets: VideoAsset[]
  uploadAudio: (file: File) => void
  uploadVideo: (file: File) => void
} {
  const [audioAssets, setAudioAssets] = useState<AudioAsset[]>([])
  const [videoLibraryAssets, setVideoLibraryAssets] = useState<VideoAsset[]>([])
  const fillTokenRef = useRef({ audio: 0, video: 0 })

  const uploadPublicResource = useCallback(async (file: File, type: "audio" | "video") => {
    const form = new FormData()
    form.set("file", file)
    form.set("type", type)
    form.set("name", file.name.replace(/\\.[^/.]+$/, ""))
    const durationMs = await getMediaDurationMsFromFile(file, type)
    if (typeof durationMs === "number") form.set("durationMs", String(durationMs))
    const res = await fetch("/api/library/public-resources/upload", { method: "POST", body: form })
    const json = (await res.json()) as { ok: boolean; error?: { message?: string } }
    if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`)
  }, [])

  const loadAudio = useCallback(async () => {
    try {
      const res = await fetch("/api/library/public-resources/list?type=audio&limit=200&offset=0", { cache: "no-store" })
      const json = (await res.json()) as { ok: boolean; data?: { items?: any[] } }
      if (!res.ok || !json?.ok || !Array.isArray(json.data?.items)) {
        setAudioAssets([])
        return
      }
      const next = json.data.items
        .map((row) => ({
          id: String(row.id),
          name: typeof row.name === "string" ? row.name : "audio",
          kind: "audio" as const,
          src: typeof row.originalUrl === "string" ? row.originalUrl : typeof row.previewUrl === "string" ? row.previewUrl : undefined,
          durationSeconds: (() => {
            const ms = normalizeDurationMs(row.durationMs)
            return typeof ms === "number" ? ms / 1000 : null
          })()
        }))
        .filter((v) => v.id && v.name)
      setAudioAssets(next)

      const token = (fillTokenRef.current.audio += 1)
      void (async () => {
        for (const item of next) {
          if (fillTokenRef.current.audio !== token) return
          const hasDuration = typeof (item as any).durationSeconds === "number" && Number.isFinite((item as any).durationSeconds) && (item as any).durationSeconds > 0
          if (hasDuration) continue
          if (!item.src) continue
          const durationMs = await getMediaDurationMsFromUrl(item.src, "audio")
          if (fillTokenRef.current.audio !== token) return
          if (typeof durationMs !== "number") continue
          const durationSeconds = durationMs / 1000
          setAudioAssets((prev) => prev.map((p: any) => (p.id === item.id ? { ...p, durationSeconds } : p)))
          void persistPublicResourceDurationMs(item.id, durationMs).catch(() => {})
        }
      })()
    } catch {
      setAudioAssets([])
    }
  }, [])

  const loadVideoLibrary = useCallback(async () => {
    try {
      const res = await fetch("/api/library/public-resources/list?type=video&limit=200&offset=0", { cache: "no-store" })
      const json = (await res.json()) as { ok: boolean; data?: { items?: any[] } }
      if (!res.ok || !json?.ok || !Array.isArray(json.data?.items)) {
        setVideoLibraryAssets([])
        return
      }
      const next = json.data.items
        .map((row) => {
          const src = typeof row.originalUrl === "string" ? row.originalUrl : typeof row.previewUrl === "string" ? row.previewUrl : undefined
          const durationMs = normalizeDurationMs(row.durationMs)
          return {
            id: String(row.id),
            name: typeof row.name === "string" ? row.name : "video",
            kind: "video" as const,
            src,
            durationSeconds: typeof durationMs === "number" ? durationMs / 1000 : null
          }
        })
        .filter((v) => v.id && v.name && v.src)
      setVideoLibraryAssets(next)

      const token = (fillTokenRef.current.video += 1)
      void (async () => {
        for (const item of next) {
          if (fillTokenRef.current.video !== token) return
          const hasDuration = typeof item.durationSeconds === "number" && Number.isFinite(item.durationSeconds) && item.durationSeconds > 0
          if (hasDuration) continue
          if (!item.src) continue
          const durationMs = await getMediaDurationMsFromUrl(item.src, "video")
          if (fillTokenRef.current.video !== token) return
          if (typeof durationMs !== "number") continue
          const durationSeconds = durationMs / 1000
          setVideoLibraryAssets((prev) => prev.map((p) => (p.id === item.id ? { ...p, durationSeconds } : p)))
          void persistPublicResourceDurationMs(item.id, durationMs).catch(() => {})
        }
      })()
    } catch {
      setVideoLibraryAssets([])
    }
  }, [])

  useEffect(() => {
    if (typeof queueMicrotask === "function") {
      queueMicrotask(() => {
        void loadAudio()
        void loadVideoLibrary()
      })
      return
    }
    void Promise.resolve().then(() => Promise.all([loadAudio(), loadVideoLibrary()]))
  }, [loadAudio, loadVideoLibrary])

  const uploadAudio = useCallback(
    (file: File) => {
      void uploadPublicResource(file, "audio")
        .then(() => loadAudio())
        .catch(() => {})
    },
    [loadAudio, uploadPublicResource]
  )

  const uploadVideo = useCallback(
    (file: File) => {
      void uploadPublicResource(file, "video")
        .then(() => loadVideoLibrary())
        .catch(() => {})
    },
    [loadVideoLibrary, uploadPublicResource]
  )

  return { audioAssets, videoLibraryAssets, uploadAudio, uploadVideo }
}
