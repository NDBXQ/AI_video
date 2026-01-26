"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react"
import { useRouter } from "next/navigation"
import { useWorkspaceData } from "../hooks/useWorkspaceData"
import { useWorkspaceState } from "../hooks/useWorkspaceState"
import { useGenerationActions } from "../hooks/useGenerationActions"
import { MediaPreviewPanel } from "./CreatePage/MediaPreviewPanel"
import { GenerationHeader } from "./CreatePage/GenerationHeader"
import { ImageParamsSidebar } from "./CreatePage/ImageParamsSidebar"
import { VideoParamsSidebar } from "./CreatePage/VideoParamsSidebar"
import { ChipEditModal } from "@/features/video/components/ChipEditModal"
import { ImagePreviewModal } from "./ImagePreviewModal"
import type { VideoAssetGroup } from "./VideoTimeline/VideoAssetSidebar"
import { createLocalPreviewSvg, uniqueStrings, clampInt } from "../utils/previewUtils"
import shellStyles from "./ImageCreate/Shell.module.css"

export function CreateWorkspacePage({
  initialTab,
  sceneNo,
  storyboardId,
  storyId,
  outlineId
}: {
  initialTab: "image" | "video"
  sceneNo: number
  storyboardId?: string
  storyId?: string
  outlineId?: string
}): ReactElement {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"image" | "video">(initialTab)
  const [activeStoryboardId, setActiveStoryboardId] = useState<string>(storyboardId ?? "")
  const [timelineDraft, setTimelineDraft] = useState<{ videoClips: any[]; audioClips: any[] } | null>(null)
  const timelineSaveTimerRef = useRef<number | null>(null)
  const timelineLoadedRef = useRef(false)
  const timelineDraftRef = useRef<{ videoClips: any[]; audioClips: any[] } | null>(null)
  const [videoAssetGroups, setVideoAssetGroups] = useState<VideoAssetGroup[]>([])

  useEffect(() => {
    timelineDraftRef.current = timelineDraft
  }, [timelineDraft])

  const {
    items,
    setItems,
    isLoading,
    loadError,
    activePreviews
  } = useWorkspaceData({
    storyId,
    outlineId,
    storyboardId,
    activeStoryboardId,
    setActiveStoryboardId
  })

  const activeItem = useMemo(
    () => items.find((it) => it.id === activeStoryboardId) ?? items[0] ?? null,
    [activeStoryboardId, items]
  )
  const activeSceneNo = activeItem?.scene_no ?? sceneNo
  const hasExistingVideo = Boolean((activeItem?.videoInfo?.url ?? "").trim() || (activeItem?.videoInfo?.storageKey ?? "").trim())

  const {
    imagePrompt, setImagePrompt,
    lastImagePrompt, setLastImagePrompt,
    videoPrompt, setVideoPrompt,
    hasVoice, setHasVoice,
    sceneText, setSceneText,
    roles, setRoles,
    roleItems, setRoleItems,
    storyboardMode, setStoryboardMode,
    durationSeconds, setDurationSeconds,
    addModal, setAddModal,
    previewImageSrcById, setPreviewImageSrcById,
    previewVideoSrcById, setPreviewVideoSrcById,
    preview, setPreview
  } = useWorkspaceState({ activeItem, storyId, outlineId, activeTab })

  const { handleGenerateImage, handleGenerateVideo, isGeneratingImage, isGeneratingVideo } = useGenerationActions({
    activeStoryboardId,
    activeSceneNo,
    imagePrompt,
    lastImagePrompt,
    videoPrompt,
    hasVoice,
    existingFirstFrameUrl: (activeItem?.frames?.first?.url ?? activeItem?.frames?.first?.thumbnailUrl ?? null) as any,
    existingLastFrameUrl: (activeItem?.frames?.last?.url ?? activeItem?.frames?.last?.thumbnailUrl ?? null) as any,
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
  })

  const thumbnails = useMemo(() => {
    if (items.length === 0) {
      return [
        {
          id: activeStoryboardId || `scene-${sceneNo}`,
          title: `镜 ${sceneNo}`,
          imageSrc: createLocalPreviewSvg(`镜 ${sceneNo}`),
          firstFrameSrc: createLocalPreviewSvg(`镜 ${sceneNo}`)
        }
      ]
    }
    return items.map((it) => ({
      id: it.id,
      title: `镜 ${it.scene_no}`,
      firstFrameSrc:
        ((previewImageSrcById[it.id] ?? "").trim().startsWith("http") || (previewImageSrcById[it.id] ?? "").trim().startsWith("data:"))
          ? (previewImageSrcById[it.id] ?? "").trim()
          : (((it.frames?.first?.thumbnailUrl ?? "").trim() || (it.frames?.first?.url ?? "").trim()) || createLocalPreviewSvg(`镜 ${it.scene_no}`)),
      imageSrc:
        (activeTab === "video"
          ? previewVideoSrcById[it.id] ?? it.videoInfo?.url ?? createLocalPreviewSvg(`镜 ${it.scene_no} / 未生成`)
          : (() => {
              const local = (previewImageSrcById[it.id] ?? "").trim()
              if (local.startsWith("http") || local.startsWith("data:")) return local

              const dbUrl = (it.frames?.first?.url ?? "").trim()
              const dbThumb = (it.frames?.first?.thumbnailUrl ?? "").trim()
              const isComposed = (u: string) => u.includes("composed_")
              if (dbUrl && isComposed(dbUrl)) return dbUrl
              if (dbThumb && isComposed(dbThumb)) return dbThumb
              return createLocalPreviewSvg(`镜 ${it.scene_no}`)
            })())
    }))
  }, [activeStoryboardId, activeTab, items, previewImageSrcById, previewVideoSrcById, sceneNo])

  useEffect(() => {
    if (!storyId) return
    let ignore = false
    timelineLoadedRef.current = false
    const load = async () => {
      try {
        const res = await fetch(`/api/video/timeline?storyId=${encodeURIComponent(storyId)}`, { cache: "no-store" })
        const json = (await res.json()) as { ok: boolean; data?: { timeline?: any } }
        if (!res.ok || !json?.ok) return
        const tl = json.data?.timeline
        if (ignore) return
        if (tl && typeof tl === "object") {
          setTimelineDraft({
            videoClips: Array.isArray((tl as any).videoClips) ? (tl as any).videoClips : [],
            audioClips: Array.isArray((tl as any).audioClips) ? (tl as any).audioClips : []
          })
        } else {
          setTimelineDraft(null)
        }
      } catch {
      } finally {
        if (!ignore) timelineLoadedRef.current = true
      }
    }
    void load()
    return () => {
      ignore = true
    }
  }, [storyId])

  useEffect(() => {
    return () => {
      if (timelineSaveTimerRef.current) {
        window.clearTimeout(timelineSaveTimerRef.current)
        timelineSaveTimerRef.current = null
      }
    }
  }, [])

  const queueSaveTimeline = useCallback((next: { videoClips: any[]; audioClips: any[] }) => {
    if (!storyId) return
    if (!timelineLoadedRef.current) return
    const prev = timelineDraftRef.current
    try {
      if (prev && JSON.stringify(prev) === JSON.stringify(next)) return
    } catch {}
    setTimelineDraft(next)
    if (timelineSaveTimerRef.current) window.clearTimeout(timelineSaveTimerRef.current)
    timelineSaveTimerRef.current = window.setTimeout(() => {
      timelineSaveTimerRef.current = null
      void fetch("/api/video/timeline", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId, timeline: { version: 1, ...next } })
      }).catch(() => {})
    }, 800)
  }, [storyId])

  useEffect(() => {
    if (activeTab !== "video" || !storyId) {
      setVideoAssetGroups([])
      return
    }
    let ignore = false

    const runTasksWithConcurrency = async (tasks: Array<() => Promise<void>>, limit: number) => {
      const normalizedLimit = Math.max(1, Math.floor(limit))
      let cursor = 0
      const workers = Array.from({ length: Math.min(normalizedLimit, tasks.length) }, async () => {
        while (cursor < tasks.length) {
          const current = cursor
          cursor += 1
          await tasks[current]?.()
        }
      })
      await Promise.all(workers)
    }

    const load = async () => {
      try {
        const baseRes = await fetch(`/api/video/storyboards?storyId=${encodeURIComponent(storyId)}`, { cache: "no-store" })
        const baseJson = (await baseRes.json().catch(() => null)) as { ok: boolean; data?: { outlines?: any[] } } | null
        if (!baseRes.ok || !baseJson?.ok) return
        const outlines = Array.isArray(baseJson.data?.outlines) ? (baseJson.data?.outlines ?? []) : []
        const sorted = outlines
          .map((o) => ({
            id: String(o?.id ?? ""),
            sequence: Number(o?.sequence ?? 0),
            label: `第${Number(o?.sequence ?? 0)}集`
          }))
          .filter((o) => o.id)
          .sort((a, b) => a.sequence - b.sequence)

        const results: Array<VideoAssetGroup | null> = new Array(sorted.length).fill(null)

        await runTasksWithConcurrency(
          sorted.map((outline, idx) => async () => {
            const res = await fetch(
              `/api/video/storyboards?storyId=${encodeURIComponent(storyId)}&outlineId=${encodeURIComponent(outline.id)}`,
              { cache: "no-store" }
            )
            const json = (await res.json().catch(() => null)) as { ok: boolean; data?: { shots?: any[] } } | null
            if (!res.ok || !json?.ok) return
            const shots = Array.isArray(json.data?.shots) ? (json.data?.shots ?? []) : []
            const segments = shots
              .map((s) => {
                const id = String(s?.id ?? "")
                const sequence = Number(s?.sequence ?? s?.scene_no ?? 0)
                const title = `镜 ${sequence || 0}`
                const url = typeof s?.videoInfo?.url === "string" ? s.videoInfo.url.trim() : ""
                const durationSeconds =
                  typeof s?.videoInfo?.durationSeconds === "number" && Number.isFinite(s.videoInfo.durationSeconds) && s.videoInfo.durationSeconds > 0
                    ? s.videoInfo.durationSeconds
                    : null
                if (!id || !url) return null
                return { id, title, videoSrc: url, durationSeconds }
              })
              .filter(Boolean) as Array<{ id: string; title: string; videoSrc: string; durationSeconds: number | null }>

            if (segments.length === 0) return
            results[idx] = { outlineId: outline.id, label: outline.label, segments }
          }),
          5
        )

        if (ignore) return
        setVideoAssetGroups(results.filter(Boolean) as VideoAssetGroup[])
      } catch {
        if (!ignore) setVideoAssetGroups([])
      }
    }

    void load()
    return () => {
      ignore = true
    }
  }, [activeTab, storyId])

  const handleTimelineChange = useCallback((tl: { videoClips: any[]; audioClips: any[] }) => queueSaveTimeline(tl), [queueSaveTimeline])

  const timelineSegments = useMemo(() => {
    if (activeTab !== "video") return []
    if (videoAssetGroups.length > 0) {
      return videoAssetGroups.flatMap((g) =>
        (g.segments ?? []).map((s) => ({
          id: s.id,
          title: `${g.label} ${s.title}`.trim(),
          videoSrc: (s.videoSrc ?? "").trim() || null,
          durationSeconds: s.durationSeconds ?? null
        }))
      )
    }
    return items
      .map((it) => {
        const candidate = (previewVideoSrcById[it.id] ?? it.videoInfo?.url ?? "").trim()
        const durationSeconds =
          typeof it.videoInfo?.durationSeconds === "number" && Number.isFinite(it.videoInfo.durationSeconds) && it.videoInfo.durationSeconds > 0
            ? it.videoInfo.durationSeconds
            : null
        return { id: it.id, title: `镜 ${it.scene_no}`, videoSrc: candidate || null, durationSeconds }
      })
      .filter((s) => Boolean((s.videoSrc ?? "").trim()))
  }, [activeTab, items, previewVideoSrcById, videoAssetGroups])

  const activePreview = useMemo(
    () => thumbnails.find((it) => it.id === activeStoryboardId) ?? thumbnails[0],
    [activeStoryboardId, thumbnails]
  )

  const activeFrameImages = useMemo(() => {
    if (!activeItem) return { first: null, last: null }
    const local = (previewImageSrcById[activeItem.id] ?? "").trim()
    const firstFromDb = ((activeItem.frames?.first?.url ?? "").trim() || (activeItem.frames?.first?.thumbnailUrl ?? "").trim()) || null
    const lastFromDb = ((activeItem.frames?.last?.url ?? "").trim() || (activeItem.frames?.last?.thumbnailUrl ?? "").trim()) || null
    const first = local.startsWith("http") || local.startsWith("data:") ? local : firstFromDb
    return { first, last: lastFromDb }
  }, [activeItem, previewImageSrcById])

  const openFrameImagePreview = useCallback(
    async ({ label, src }: { label: string; src: string }) => {
      if (!activeItem) return
      const storyboardId = activeItem.id
      const rawUrl = (src ?? "").trim()
      if (!rawUrl || rawUrl.startsWith("data:")) {
        alert("未生成可编辑的图片")
        return
      }

      const normalizeUrlKey = (u: string) => {
        try {
          const url = new URL(u)
          url.search = ""
          url.hash = ""
          return `${url.origin}${url.pathname}`
        } catch {
          return u
        }
      }

      let generatedImageId: string | undefined
      try {
        const qs = new URLSearchParams({ storyboardId, limit: "200", offset: "0" })
        const res = await fetch(`/api/video-creation/images?${qs.toString()}`, { cache: "no-store" })
        const json = (await res.json().catch(() => null)) as { ok: boolean; data?: { items?: any[] } } | null
        const rows = Array.isArray(json?.data?.items) ? (json?.data?.items ?? []) : []
        const targetKey = normalizeUrlKey(rawUrl)
        const hit = rows.find((r) => {
          const url = typeof r?.url === "string" ? r.url : ""
          const thumb = typeof r?.thumbnailUrl === "string" ? r.thumbnailUrl : ""
          return (url && normalizeUrlKey(url) === targetKey) || (thumb && normalizeUrlKey(thumb) === targetKey)
        })
        const id = typeof hit?.id === "string" ? hit.id : ""
        if (id) generatedImageId = id
      } catch {}

      const prompt =
        label.includes("尾") ? ((activeItem.frames?.last?.prompt ?? lastImagePrompt) || "") : ((activeItem.frames?.first?.prompt ?? imagePrompt) || "")

      const title = `${activePreview?.title ?? `镜 ${activeItem.scene_no}`} ${label}`.trim()

      setPreview({
        title,
        imageSrc: rawUrl,
        generatedImageId,
        storyboardId,
        category: "background",
        frameKind: label.includes("尾") ? "last" : "first",
        description: sceneText,
        prompt
      })
    },
    [activeItem, activePreview?.title, imagePrompt, lastImagePrompt, sceneText, setPreview]
  )

  const handleBack = () => {
    const qs = new URLSearchParams({ tab: "board" })
    if (storyId) qs.set("storyId", storyId)
    if (outlineId) qs.set("outlineId", outlineId)
    router.push(`/video?${qs.toString()}`)
  }

  const sceneSwitch = useMemo(() => {
    if (items.length === 0) return { canPrev: false, canNext: false, prevId: "", nextId: "" }
    const currentId = activeItem?.id ?? items[0]!.id
    const idx = items.findIndex((it) => it.id === currentId)
    const safeIdx = idx >= 0 ? idx : 0
    const prev = items[safeIdx - 1]?.id ?? ""
    const next = items[safeIdx + 1]?.id ?? ""
    return { canPrev: Boolean(prev), canNext: Boolean(next), prevId: prev, nextId: next }
  }, [activeItem?.id, items])

  const prevVideoLastFrameUrl = useMemo(() => {
    if (!activeItem) return null
    const idx = items.findIndex((it) => it.id === activeItem.id)
    if (idx <= 0) return null
    const prev = items[idx - 1]
    const raw = (prev?.videoInfo as any)?.settings?.lastFrameUrl
    const v = typeof raw === "string" ? raw.trim() : ""
    return v || null
  }, [activeItem, items])

  const usePrevVideoLastFrameAsFirst = useCallback(
    async (url: string) => {
      const storyboardId = activeStoryboardId
      const normalized = url.trim()
      if (!storyboardId || !normalized) throw new Error("未找到可用的尾帧图")

      const res = await fetch("/api/video/storyboards", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyboardId, frames: { first: { url: normalized } } })
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: { message?: string } } | null
      if (!res.ok || !json || json.ok !== true) {
        throw new Error(json?.error?.message ?? `HTTP ${res.status}`)
      }

      setItems((prev) =>
        prev.map((it) => {
          if (it.id !== storyboardId) return it
          const nextFrames = { ...(it.frames ?? {}), first: { ...(it.frames?.first ?? {}), url: normalized } }
          return { ...it, frames: nextFrames }
        })
      )
      setPreviewImageSrcById((prev) => {
        const next = { ...prev }
        if (next[storyboardId]) next[storyboardId] = ""
        return next
      })
    },
    [activeStoryboardId, setItems, setPreviewImageSrcById]
  )

  const switchTab = (tab: "image" | "video") => {
    setActiveTab(tab)
    // URL sync is handled in useWorkspaceState or we can do it here if needed, 
    // but useWorkspaceState has an effect that watches activeTab.
    // However, the original code had URL sync in switchTab AND useEffect.
    // The hook has it in useEffect dependent on activeTab.
  }

  if (isLoading) return <div className={shellStyles.shell}>加载中…</div>
  if (loadError) return <div className={shellStyles.shell}>{loadError}</div>

  return (
    <div className={shellStyles.shell} aria-label="生图/生视频工作台">
      <ImagePreviewModal
        open={Boolean(preview)}
        title={preview?.title ?? ""}
        imageSrc={preview?.imageSrc ?? ""}
        generatedImageId={preview?.generatedImageId}
        storyboardId={preview?.storyboardId ?? activeStoryboardId}
        category={preview?.category ?? null}
        frameKind={preview?.frameKind ?? null}
        description={preview?.description ?? null}
        prompt={preview?.prompt ?? null}
        onStoryboardFrameUpdated={(p: { storyboardId: string; frameKind: "first" | "last"; url: string; thumbnailUrl: string | null }) => {
          const { storyboardId, frameKind, url, thumbnailUrl } = p
          if (!storyboardId) return
          if (frameKind === "first") setPreviewImageSrcById((prev) => ({ ...prev, [storyboardId]: url }))
          setItems((prev) =>
            prev.map((it) => {
              if (it.id !== storyboardId) return it
              const baseFrames = it.frames ?? {}
              const patch = frameKind === "first" ? { first: { ...(baseFrames.first ?? {}), url, thumbnailUrl } } : { last: { ...(baseFrames.last ?? {}), url, thumbnailUrl } }
              return { ...it, frames: { ...baseFrames, ...patch } as any }
            })
          )
        }}
        onClose={() => setPreview(null)}
      />
      <GenerationHeader
        onBack={handleBack}
        activeTab={activeTab}
        onTabChange={(tab) => switchTab(tab)}
        sceneNo={activeSceneNo}
        recommendedStoryboardMode={((activeItem?.videoInfo as any)?.settings?.mode as any) ?? null}
        canPrevScene={sceneSwitch.canPrev}
        canNextScene={sceneSwitch.canNext}
        onPrevScene={() => {
          if (!sceneSwitch.prevId) return
          setActiveStoryboardId(sceneSwitch.prevId)
        }}
        onNextScene={() => {
          if (!sceneSwitch.nextId) return
          setActiveStoryboardId(sceneSwitch.nextId)
        }}
        info={[
          ...(activeTab === "video" ? [{ label: "时长", value: `${clampInt(durationSeconds, 4, 12, 4)}s` }] : [])
        ]}
      />

      <div className={shellStyles.workspaceWrap}>
        <div
          className={shellStyles.body}
          style={
            {
              ["--dock-h" as any]: activeTab === "video" ? "260px" : "120px",
              ["--dock-gap" as any]: "8px",
              gridTemplateRows: "calc(100% - var(--dock-h, 0px) - var(--dock-gap, 0px)) var(--dock-h, 0px)",
              rowGap: "var(--dock-gap, 0px)",
              columnGap: "8px"
            } as any
          }
        >
          {activeTab === "image" ? (
            <ImageParamsSidebar
              key={`image-sidebar-${activeStoryboardId}`}
              prompt={imagePrompt}
              setPrompt={setImagePrompt}
              tailPrompt={lastImagePrompt}
              setTailPrompt={setLastImagePrompt}
              isGenerating={isGeneratingImage}
              recommendedStoryboardMode={((activeItem?.videoInfo as any)?.settings?.mode as any) ?? null}
              shotCut={Boolean(!activeItem?.shot_info?.cut_to)}
              prevVideoLastFrameUrl={prevVideoLastFrameUrl}
              onUsePrevVideoLastFrame={usePrevVideoLastFrameAsFirst}
              sceneText={sceneText}
              setSceneText={setSceneText}
              roles={roles}
              setRoles={setRoles}
              items={roleItems}
              setItems={setRoleItems}
              onGenerate={handleGenerateImage}
              onPreviewImage={(title, imageSrc, generatedImageId, storyboardId, category, description, prompt) =>
                setPreview({ title, imageSrc, generatedImageId, storyboardId: storyboardId ?? activeStoryboardId, category, description, prompt })
              }
              previews={activePreviews}
            />
          ) : (
            <VideoParamsSidebar
              prompt={videoPrompt}
              setPrompt={setVideoPrompt}
              storyboardMode={storyboardMode}
              setStoryboardMode={setStoryboardMode}
              durationSeconds={durationSeconds}
              setDurationSeconds={setDurationSeconds}
              hasVoice={hasVoice}
              setHasVoice={setHasVoice}
              isGenerating={isGeneratingVideo}
              onGenerate={handleGenerateVideo}
            />
          )}

          <div aria-hidden style={{ gridColumn: 1, gridRow: 2 }} />

          <div
            style={
              {
                gridColumn: 2,
                gridRow: "1 / span 2",
                minHeight: 0,
                ["--left-col-w" as any]: "340px",
                ["--col-gap" as any]: "8px"
              } as any
            }
          >
            <MediaPreviewPanel
              mode={activeTab}
              activeImageSrc={activePreview?.imageSrc ?? ""}
              activeFrameImages={activeTab === "image" ? activeFrameImages : undefined}
              activeTitle={activePreview?.title ?? ""}
              thumbnails={thumbnails}
              activeId={activeStoryboardId || thumbnails[0]?.id || ""}
              onOpenFrameImage={openFrameImagePreview}
              timelineSegments={timelineSegments}
              videoAssetGroups={activeTab === "video" ? videoAssetGroups : undefined}
              timelineKey={storyId ?? "no-story"}
              initialTimeline={timelineDraft}
              onTimelineChange={handleTimelineChange}
              onThumbnailClick={(id) => {
                if (id === activeStoryboardId) return
                setActiveStoryboardId(id)
              }}
            />
          </div>
        </div>
      </div>

      <ChipEditModal
        open={addModal.open}
        title={addModal.kind === "role" ? "选择角色" : addModal.kind === "item" ? "选择物品" : "选择背景"}
        placeholder={addModal.kind === "role" ? "请输入角色名" : addModal.kind === "item" ? "请输入物品" : "请输入背景"}
        onClose={() => setAddModal((p) => ({ ...p, open: false }))}
        onSubmit={(value) => {
          const trimmed = value.trim()
          if (!trimmed) return
          if (addModal.kind === "role") setRoles((p) => uniqueStrings([...p, trimmed]))
          if (addModal.kind === "item") setRoleItems((p) => uniqueStrings([...p, trimmed]))
          if (addModal.kind === "background") setSceneText(trimmed)
          setAddModal((p) => ({ ...p, open: false }))
        }}
      />
    </div>
  )
}
