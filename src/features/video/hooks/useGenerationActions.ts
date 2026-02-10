import { useEffect, useMemo, useState } from "react"
import { logger } from "@/shared/logger"
import type { ApiErr, ApiOk } from "@/shared/api"
import { apiFetchJson } from "@/shared/apiClient"
import type { StoryboardItem } from "@/features/video/types"
import { createLocalPreviewSvg, clampInt } from "@/shared/utils/previewUtils"
import { clearClientLock, readClientLock, writeClientLock } from "../utils/generationLocks"
import { buildReferenceImages, type ActivePreviews } from "../utils/referenceImages"
import type { RequestState } from "@/shared/requestStatus"

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
  } | ActivePreviews
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
  const [imageRequest, setImageRequest] = useState<RequestState<{ firstUrl?: string; lastUrl?: string }>>({ status: "idle" })
  const [videoRequest, setVideoRequest] = useState<RequestState<{ url: string }>>({ status: "idle" })

  useEffect(() => {
    setIsGeneratingImage(readClientLock(imageLockKey, 20 * 60 * 1000))
    setIsGeneratingVideo(readClientLock(videoLockKey, 60 * 60 * 1000))
  }, [imageLockKey, videoLockKey])

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

    const json = await apiFetchJson<unknown>("/api/video/storyboards", {
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
    if (!json.ok) {
      logger.error({
        event: kind === "image" ? "storyboard_image_prompt_save_failed" : "storyboard_video_prompt_save_failed",
        module: "video",
        traceId: json.traceId ?? "client",
        message: kind === "image" ? "保存生图提示词失败" : "保存生视频提示词失败",
        storyboardId: activeStoryboardId,
        durationMs: Math.round(performance.now() - start),
        errorMessage: json?.error?.message
      })
      throw { message: json?.error?.message ?? "保存提示词失败", traceId: json.traceId, code: json?.error?.code }
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

  const handleGenerateImage = async (opts?: { mode?: "both" | "tailOnly" }) => {
    if (!activeStoryboardId) return
    if (isGeneratingImage || readClientLock(imageLockKey, 20 * 60 * 1000)) return
    const mode = opts?.mode ?? "both"
    setIsGeneratingImage(true)
    writeClientLock(imageLockKey)
    const startedAt = Date.now()
    setImageRequest({ status: "pending", startedAt })
    try {
      if (mode === "tailOnly") {
        const jsonPrompt = await apiFetchJson<unknown>("/api/video/storyboards", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storyboardId: activeStoryboardId, frames: { last: { prompt: lastImagePrompt } } })
        })
        if (!jsonPrompt.ok) throw { message: jsonPrompt?.error?.message ?? "保存尾帧提示词失败", traceId: jsonPrompt.traceId, code: jsonPrompt?.error?.code }
      } else {
        await savePrompt("image")
        setPreviewImageSrcById((prev) => ({ ...prev, [activeStoryboardId]: createLocalPreviewSvg(`镜 ${activeSceneNo} / 合成中...`) }))
      }
      const referenceImages = buildReferenceImages({ activePreviews: activePreviews as any, sceneText, roles, roleItems })
      const json = await apiFetchJson<any>(mode === "tailOnly" ? "/api/video-creation/images/compose-tail" : "/api/video-creation/images/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyboardId: activeStoryboardId, referenceImages })
      })
      if (!json.ok) throw { message: json?.error?.message ?? "合成失败", traceId: json.traceId, code: json?.error?.code }
      const okJson = json as ApiOk<any>
      if (mode === "tailOnly") {
        const last = okJson.data?.lastImage ?? null
        const lastUrl = (last?.url ?? last?.thumbnailUrl ?? "").trim()
        if (!lastUrl) throw new Error("合成成功但缺少尾帧图片 URL")
        setItems((prev) =>
          prev.map((it) => {
            if (it.id !== activeStoryboardId) return it
            return {
              ...it,
              frames: {
                ...it.frames,
                last: {
                  ...(it.frames?.last ?? {}),
                  url: last?.url ?? it.frames?.last?.url ?? null,
                  thumbnailUrl: last?.thumbnailUrl ?? it.frames?.last?.thumbnailUrl ?? null
                }
              }
            }
          })
        )
      } else {
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
      }
      setImageRequest({
        status: "success",
        startedAt,
        finishedAt: Date.now(),
        data: {
          firstUrl: okJson.data.image?.url ?? okJson.data.image?.thumbnailUrl ?? undefined,
          lastUrl: okJson.data.lastImage?.url ?? okJson.data.lastImage?.thumbnailUrl ?? undefined
        },
        traceId: okJson.traceId
      })
      clearClientLock(imageLockKey)
    } catch (e) {
      const anyErr = e as { message?: string; traceId?: string; code?: string }
      if ((opts?.mode ?? "both") !== "tailOnly") {
        setPreviewImageSrcById((prev) => ({ ...prev, [activeStoryboardId]: createLocalPreviewSvg(`镜 ${activeSceneNo} / 合成失败`) }))
      }
      setImageRequest({
        status: "error",
        startedAt,
        finishedAt: Date.now(),
        error: { code: anyErr?.code ?? "IMAGE_COMPOSE_FAILED", message: anyErr?.message ?? "合成失败" },
        traceId: anyErr?.traceId ?? "client"
      })
      clearClientLock(imageLockKey)
    } finally {
      setIsGeneratingImage(false)
    }
  }

  const handleGenerateVideo = async () => {
    if (!activeStoryboardId) return
    if (isGeneratingVideo || readClientLock(videoLockKey, 60 * 60 * 1000)) return
    setIsGeneratingVideo(true)
    writeClientLock(videoLockKey)
    const startedAt = Date.now()
    setVideoRequest({ status: "pending", startedAt })
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

        const referenceImages = buildReferenceImages({ activePreviews: activePreviews as any, sceneText, roles, roleItems })
        const json = await apiFetchJson<{ image?: { url?: string; thumbnailUrl?: string | null }; lastImage?: { url?: string; thumbnailUrl?: string | null } }>("/api/video-creation/images/compose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storyboardId: activeStoryboardId, referenceImages })
        })
        if (!json.ok) throw { message: json?.error?.message ?? "合成失败", traceId: json.traceId, code: json?.error?.code }
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

      const json = await apiFetchJson<{ video?: { url?: string } }>("/api/video-creation/videos/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyboardId: activeStoryboardId,
          storyId,
          prompt: videoPrompt,
          mode: storyboardMode,
          duration: clampInt(durationSeconds, 4, 12, 4),
          watermark: false,
          forceRegenerate: hasExistingVideo,
          return_last_frame: true,
          generate_audio: hasVoice,
          first_image: { url: images.first, file_type: "image" },
          last_image: images.last ? { url: images.last, file_type: "image" } : undefined
        })
      })
      if (!json.ok) throw { message: json?.error?.message ?? "生成失败", traceId: json.traceId, code: json?.error?.code }
      const okJson = json as ApiOk<{ video?: { url?: string } }>
      const videoUrl = okJson.data.video?.url ?? ""
      if (!videoUrl) throw new Error("生成成功但缺少视频 URL")
      setPreviewVideoSrcById((prev) => ({ ...prev, [activeStoryboardId]: videoUrl }))
      setItems((prev) =>
        prev.map((it) => (it.id === activeStoryboardId ? { ...it, videoInfo: { ...(it.videoInfo ?? {}), url: videoUrl } } : it))
      )
      setVideoRequest({ status: "success", startedAt, finishedAt: Date.now(), data: { url: videoUrl }, traceId: okJson.traceId })
      clearClientLock(videoLockKey)
    } catch (e) {
      const anyErr = e as { message?: string; traceId?: string; code?: string }
      logger.error({
        event: "video_generate_failed",
        module: "video",
        traceId: anyErr?.traceId ?? "client",
        message: "生视频流程失败",
        storyboardId: activeStoryboardId,
        errorMessage: anyErr?.message
      })
      setPreviewVideoSrcById((prev) => ({ ...prev, [activeStoryboardId]: createLocalPreviewSvg(`镜 ${activeSceneNo} / 生成失败`) }))
      setVideoRequest({
        status: "error",
        startedAt,
        finishedAt: Date.now(),
        error: { code: anyErr?.code ?? "VIDEO_GENERATE_FAILED", message: anyErr?.message ?? "生成失败" },
        traceId: anyErr?.traceId ?? "client"
      })
      clearClientLock(videoLockKey)
    } finally {
      setIsGeneratingVideo(false)
    }
  }

  return { handleGenerateImage, handleGenerateVideo, isGeneratingImage, isGeneratingVideo, imageRequest, videoRequest }
}
