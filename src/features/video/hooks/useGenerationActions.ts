import { useEffect, useMemo, useState } from "react"
import { logger } from "@/shared/logger"
import type { ApiErr, ApiOk } from "@/shared/api"
import type { StoryboardItem } from "@/features/video/types"
import { createLocalPreviewSvg, clampInt } from "../utils/previewUtils"

type UseGenerationActionsProps = {
  activeStoryboardId: string
  activeSceneNo: number
  imagePrompt: string
  lastImagePrompt: string
  videoPrompt: string
  hasVoice: boolean
  existingFirstFrameUrl?: string | null
  existingLastFrameUrl?: string | null
  storyId?: string
  sceneText: string
  roles: string[]
  roleItems: string[]
  activePreviews?: {
    role: Array<{ id: string; name: string; url: string; thumbnailUrl?: string | null }>
    background: Array<{ id: string; name: string; url: string; thumbnailUrl?: string | null }>
    item: Array<{ id: string; name: string; url: string; thumbnailUrl?: string | null }>
  }
  storyboardMode: "首帧" | "尾帧" | "首尾帧"
  durationSeconds: string
  hasExistingVideo: boolean
  setPreviewImageSrcById: React.Dispatch<React.SetStateAction<Record<string, string>>>
  setPreviewVideoSrcById: React.Dispatch<React.SetStateAction<Record<string, string>>>
  previewImageSrcById: Record<string, string>
  setItems: React.Dispatch<React.SetStateAction<StoryboardItem[]>>
}

export function useGenerationActions({
  activeStoryboardId,
  activeSceneNo,
  imagePrompt,
  lastImagePrompt,
  videoPrompt,
  hasVoice,
  existingFirstFrameUrl,
  existingLastFrameUrl,
  storyId,
  sceneText,
  roles,
  roleItems,
  activePreviews,
  storyboardMode,
  durationSeconds,
  hasExistingVideo,
  setPreviewImageSrcById,
  setPreviewVideoSrcById,
  previewImageSrcById,
  setItems
}: UseGenerationActionsProps) {
  const imageLockKey = useMemo(() => `video:gen:image:${activeStoryboardId}`, [activeStoryboardId])
  const videoLockKey = useMemo(() => `video:gen:video:${activeStoryboardId}`, [activeStoryboardId])
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false)

  const lockIsFresh = (startedAt: number, ttlMs: number) => Number.isFinite(startedAt) && startedAt > 0 && Date.now() - startedAt < ttlMs

  const readLock = (key: string, ttlMs: number): boolean => {
    if (typeof window === "undefined") return false
    try {
      const raw = window.localStorage.getItem(key)
      if (!raw) return false
      const parsed = JSON.parse(raw) as { startedAt?: number }
      const startedAt = Number(parsed?.startedAt ?? 0)
      if (!lockIsFresh(startedAt, ttlMs)) {
        window.localStorage.removeItem(key)
        return false
      }
      return true
    } catch {
      return false
    }
  }

  const writeLock = (key: string) => {
    if (typeof window === "undefined") return
    try {
      window.localStorage.setItem(key, JSON.stringify({ startedAt: Date.now() }))
    } catch {}
  }

  const clearLock = (key: string) => {
    if (typeof window === "undefined") return
    try {
      window.localStorage.removeItem(key)
    } catch {}
  }

  useEffect(() => {
    setIsGeneratingImage(readLock(imageLockKey, 20 * 60 * 1000))
    setIsGeneratingVideo(readLock(videoLockKey, 60 * 60 * 1000))
  }, [imageLockKey, videoLockKey])

  const pickPreview = (list: Array<{ name: string; url: string; thumbnailUrl?: string | null }>, name: string) => {
    const key = name.trim()
    if (!key) return null
    const exact = list.find((p) => p.name === key)
    if (exact) return exact
    const include = list.find((p) => key.includes(p.name) || p.name.includes(key))
    if (include) return include
    if (list.length === 1) return list[0]
    return null
  }

  const buildReferenceImages = () => {
    const bgList = activePreviews?.background ?? []
    const roleList = activePreviews?.role ?? []
    const itemList = activePreviews?.item ?? []

    const out: Array<{ name: string; url: string }> = []

    const bgName = sceneText.trim()
    if (bgName) {
      const p = pickPreview(bgList, bgName)
      if (p?.url) out.push({ name: p.name, url: p.url })
    }

    for (const r of roles) {
      const p = pickPreview(roleList, r)
      if (p?.url) out.push({ name: p.name, url: p.url })
    }

    for (const it of roleItems) {
      const p = pickPreview(itemList, it)
      if (p?.url) out.push({ name: p.name, url: p.url })
    }

    const seen = new Set<string>()
    return out.filter((v) => {
      const k = `${v.name}::${v.url}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
  }

  const savePrompt = async (kind: "image" | "video") => {
    if (!activeStoryboardId) return
    const start = performance.now()
    const prompt = kind === "image" ? imagePrompt : videoPrompt

    logger.info({
      event: kind === "image" ? "storyboard_image_prompt_save_start" : "storyboard_video_prompt_save_start",
      module: "video",
      traceId: "client",
      message: kind === "image" ? "开始保存生图提示词" : "开始保存生视频提示词",
      storyboardId: activeStoryboardId,
      promptLength: prompt.length
    })

    const res = await fetch("/api/video/storyboards", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        kind === "image"
          ? { storyboardId: activeStoryboardId, frames: { first: { prompt }, last: { prompt: lastImagePrompt } } }
          : {
              storyboardId: activeStoryboardId,
              videoInfo: {
                prompt,
                durationSeconds: clampInt(durationSeconds, 4, 12, 4),
                settings: { mode: storyboardMode, generateAudio: hasVoice, watermark: false }
              }
            }
      )
    })
    const json = (await res.json()) as ApiOk<unknown> | ApiErr
    if (!res.ok || !json || (json as ApiErr).ok === false) {
      const errJson = json as ApiErr
      logger.error({
        event: kind === "image" ? "storyboard_image_prompt_save_failed" : "storyboard_video_prompt_save_failed",
        module: "video",
        traceId: "client",
        message: kind === "image" ? "保存生图提示词失败" : "保存生视频提示词失败",
        storyboardId: activeStoryboardId,
        durationMs: Math.round(performance.now() - start),
        errorMessage: errJson?.error?.message ?? `HTTP ${res.status}`
      })
      throw new Error(errJson?.error?.message ?? `HTTP ${res.status}`)
    }

    logger.info({
      event: kind === "image" ? "storyboard_image_prompt_save_success" : "storyboard_video_prompt_save_success",
      module: "video",
      traceId: "client",
      message: kind === "image" ? "保存生图提示词成功" : "保存生视频提示词成功",
      storyboardId: activeStoryboardId,
      durationMs: Math.round(performance.now() - start)
    })
  }

  const handleGenerateImage = async () => {
    if (!activeStoryboardId) return
    if (isGeneratingImage || readLock(imageLockKey, 20 * 60 * 1000)) return
    setIsGeneratingImage(true)
    writeLock(imageLockKey)
    setPreviewImageSrcById((prev) => ({ ...prev, [activeStoryboardId]: createLocalPreviewSvg(`镜 ${activeSceneNo} / 合成中...`) }))
    try {
      await savePrompt("image")
      const referenceImages = buildReferenceImages()
      const res = await fetch("/api/video-creation/images/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyboardId: activeStoryboardId, referenceImages })
      })
      const json = (await res.json()) as ApiOk<{ image?: { url?: string; thumbnailUrl?: string | null }; lastImage?: { url?: string; thumbnailUrl?: string | null } }> | ApiErr
      if (!res.ok || !json || (json as ApiErr).ok === false) {
        const errJson = json as ApiErr
        throw new Error(errJson?.error?.message ?? `HTTP ${res.status}`)
      }
      const okJson = json as ApiOk<{ image?: { url?: string; thumbnailUrl?: string | null }; lastImage?: { url?: string; thumbnailUrl?: string | null } }>
      const imageUrl = okJson.data.image?.url ?? okJson.data.image?.thumbnailUrl ?? ""
      if (!imageUrl) throw new Error("合成成功但缺少图片 URL")
      setPreviewImageSrcById((prev) => ({ ...prev, [activeStoryboardId]: imageUrl }))
      const lastUrl = okJson.data.lastImage?.url ?? okJson.data.lastImage?.thumbnailUrl ?? ""
      setItems((prev) =>
        prev.map((it) => {
          if (it.id !== activeStoryboardId) return it
          return {
            ...it,
            frames: {
              ...it.frames,
              first: { ...(it.frames?.first ?? {}), url: okJson.data.image?.url ?? it.frames?.first?.url ?? null, thumbnailUrl: okJson.data.image?.thumbnailUrl ?? it.frames?.first?.thumbnailUrl ?? null },
              ...(lastUrl ? { last: { ...(it.frames?.last ?? {}), url: okJson.data.lastImage?.url ?? it.frames?.last?.url ?? null, thumbnailUrl: okJson.data.lastImage?.thumbnailUrl ?? it.frames?.last?.thumbnailUrl ?? null } } : {})
            }
          }
        })
      )
      clearLock(imageLockKey)
    } catch (e) {
      const anyErr = e as { message?: string }
      setPreviewImageSrcById((prev) => ({ ...prev, [activeStoryboardId]: createLocalPreviewSvg(`镜 ${activeSceneNo} / 合成失败`) }))
      alert(anyErr?.message ?? "合成失败")
      clearLock(imageLockKey)
    } finally {
      setIsGeneratingImage(false)
    }
  }

  const handleGenerateVideo = async () => {
    if (!activeStoryboardId) return
    if (isGeneratingVideo || readLock(videoLockKey, 60 * 60 * 1000)) return
    setIsGeneratingVideo(true)
    writeLock(videoLockKey)
    setPreviewVideoSrcById((prev) => ({ ...prev, [activeStoryboardId]: createLocalPreviewSvg(`镜 ${activeSceneNo} / 生成中...`) }))
    try {
      await savePrompt("video")
      const ensureComposedImages = async (): Promise<{ first: string; last: string | null }> => {
        const localFirst = (previewImageSrcById[activeStoryboardId] ?? "").trim()
        const dbFirst = (existingFirstFrameUrl ?? "").trim()
        const dbLast = (existingLastFrameUrl ?? "").trim()
        const needsLast = storyboardMode === "首尾帧"
        if (needsLast && !lastImagePrompt.trim()) throw new Error("尾帧提示词为空，无法生成首尾帧视频")
        const firstCandidate = localFirst.startsWith("http") ? localFirst : dbFirst.startsWith("http") ? dbFirst : ""
        const lastCandidate = dbLast.startsWith("http") ? dbLast : ""
        if (firstCandidate && !needsLast) return { first: firstCandidate, last: null }
        if (firstCandidate && needsLast && lastCandidate) return { first: firstCandidate, last: lastCandidate }

        const referenceImages = buildReferenceImages()
        const res = await fetch("/api/video-creation/images/compose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storyboardId: activeStoryboardId, referenceImages })
        })
        const json = (await res.json()) as ApiOk<{ image?: { url?: string; thumbnailUrl?: string | null }; lastImage?: { url?: string; thumbnailUrl?: string | null } }> | ApiErr
        if (!res.ok || !json || (json as ApiErr).ok === false) {
          const errJson = json as ApiErr
          throw new Error(errJson?.error?.message ?? `HTTP ${res.status}`)
        }
        const okJson = json as ApiOk<{ image?: { url?: string; thumbnailUrl?: string | null }; lastImage?: { url?: string; thumbnailUrl?: string | null } }>
        const first = okJson.data.image?.url ?? okJson.data.image?.thumbnailUrl ?? ""
        if (!first) throw new Error("合成成功但缺少图片 URL")
        const last = okJson.data.lastImage?.url ?? okJson.data.lastImage?.thumbnailUrl ?? ""
        if (needsLast && !last) throw new Error("尾帧图片未生成，请检查尾帧提示词")
        setPreviewImageSrcById((prev) => ({ ...prev, [activeStoryboardId]: first }))
        setItems((prev) =>
          prev.map((it) => {
            if (it.id !== activeStoryboardId) return it
            return {
              ...it,
              frames: {
                ...it.frames,
                first: { ...(it.frames?.first ?? {}), url: okJson.data.image?.url ?? it.frames?.first?.url ?? null, thumbnailUrl: okJson.data.image?.thumbnailUrl ?? it.frames?.first?.thumbnailUrl ?? null },
                ...(last ? { last: { ...(it.frames?.last ?? {}), url: okJson.data.lastImage?.url ?? it.frames?.last?.url ?? null, thumbnailUrl: okJson.data.lastImage?.thumbnailUrl ?? it.frames?.last?.thumbnailUrl ?? null } } : {})
              }
            }
          })
        )
        return { first, last: last || null }
      }

      const images = await ensureComposedImages()

      const res = await fetch("/api/video-creation/videos/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyboardId: activeStoryboardId,
          storyId,
          prompt: videoPrompt,
          mode: storyboardMode,
          ratio: "adaptive",
          duration: clampInt(durationSeconds, 4, 12, 4),
          watermark: false,
          forceRegenerate: hasExistingVideo,
          return_last_frame: true,
          generate_audio: hasVoice,
          resolution: null,
          first_image: { url: images.first, file_type: "image" },
          last_image: images.last ? { url: images.last, file_type: "image" } : undefined
        })
      })
      const json = (await res.json()) as ApiOk<{ video?: { url?: string } }> | ApiErr
      if (!res.ok || !json || (json as ApiErr).ok === false) {
        const errJson = json as ApiErr
        throw new Error(errJson?.error?.message ?? `HTTP ${res.status}`)
      }
      const okJson = json as ApiOk<{ video?: { url?: string } }>
      const videoUrl = okJson.data.video?.url ?? ""
      if (!videoUrl) throw new Error("生成成功但缺少视频 URL")
      setPreviewVideoSrcById((prev) => ({ ...prev, [activeStoryboardId]: videoUrl }))
      setItems((prev) =>
        prev.map((it) => (it.id === activeStoryboardId ? { ...it, videoInfo: { ...(it.videoInfo ?? {}), url: videoUrl } } : it))
      )
      clearLock(videoLockKey)
    } catch (e) {
      const anyErr = e as { message?: string }
      logger.error({
        event: "video_generate_failed",
        module: "video",
        traceId: "client",
        message: "生视频流程失败",
        storyboardId: activeStoryboardId,
        errorMessage: anyErr?.message
      })
      setPreviewVideoSrcById((prev) => ({ ...prev, [activeStoryboardId]: createLocalPreviewSvg(`镜 ${activeSceneNo} / 生成失败`) }))
      clearLock(videoLockKey)
    } finally {
      setIsGeneratingVideo(false)
    }
  }

  return { handleGenerateImage, handleGenerateVideo, isGeneratingImage, isGeneratingVideo }
}
