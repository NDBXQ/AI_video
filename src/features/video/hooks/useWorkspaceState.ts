import { useEffect, useRef, useState } from "react"
import type { StoryboardItem } from "@/features/video/types"
import { uniqueStrings } from "../utils/previewUtils"

type AddModalState = {
  open: boolean
  kind: "role" | "item" | "background"
}

function normalizeStoryboardMode(value: string | null | undefined): "首帧" | "首尾帧" | null {
  const raw = typeof value === "string" ? value.trim() : ""
  if (!raw) return null
  const lower = raw.toLowerCase()
  if (raw.includes("尾") || lower.includes("tail") || lower.includes("last") || lower.includes("end")) return "首尾帧"
  if (raw.includes("首") || lower.includes("first") || lower.includes("head") || lower.includes("start")) return "首帧"
  return null
}

function buildFallbackText(item: StoryboardItem, kind: "image" | "video"): string {
  const bg = item.shot_content.background
  const bgText = bg.background_name ? `${bg.background_name}${bg.status ? `（${bg.status}）` : ""}` : ""
  const roles = item.shot_content.roles ?? []
  const speak = roles.find((r) => r.speak?.content)?.speak?.content ?? ""
  const firstRole = roles.find((r) => r.role_name && r.role_name !== "旁白")
  const base = [
    `镜头：1镜 ${item.scene_no}`,
    bgText ? (kind === "image" ? `场景：${bgText}` : `背景：${bgText}`) : "",
    firstRole ? `角色：${firstRole.role_name}，动作：${firstRole.action}` : "",
    speak ? `台词：“${speak}”` : ""
  ].filter(Boolean)
  const text = base.join("\n").trim()
  return text || item.storyboard_text?.trim() || `镜头：镜 ${item.scene_no}`
}

function isAutoFallbackPrompt(value: string): boolean {
  const s = value.trim()
  if (!s) return false
  if (!s.startsWith("镜头：")) return false
  return s.includes("\n场景：") && s.includes("\n角色：") && s.includes("\n台词：")
}

function normalizeUrl({
  path,
  storyboardId,
  storyId,
  outlineId,
  sceneNo
}: {
  path: "/video/image" | "/video/video"
  storyboardId?: string
  storyId?: string
  outlineId?: string
  sceneNo?: number
}): string {
  const qs = new URLSearchParams()
  if (storyboardId) qs.set("storyboardId", storyboardId)
  if (storyId) qs.set("storyId", storyId)
  if (outlineId) qs.set("outlineId", outlineId)
  if (sceneNo && Number.isFinite(sceneNo) && sceneNo > 0) qs.set("sceneNo", String(sceneNo))
  const s = qs.toString()
  return s ? `${path}?${s}` : path
}

export function useWorkspaceState({
  activeItem,
  storyId,
  outlineId,
  activeTab
}: {
  activeItem: StoryboardItem | null
  storyId?: string
  outlineId?: string
  activeTab: "image" | "video"
}) {
  const [imagePrompt, setImagePrompt] = useState("")
  const [lastImagePrompt, setLastImagePrompt] = useState("")
  const [videoPrompt, setVideoPrompt] = useState("")
  const [hasVoice, setHasVoice] = useState(false)
  const [stylePreset, setStylePreset] = useState<string>("写实风格")
  const [cameraAngle, setCameraAngle] = useState<string>("")
  const [sceneText, setSceneText] = useState<string>("")
  const [roles, setRoles] = useState<string[]>([])
  const [roleItems, setRoleItems] = useState<string[]>([])
  const [imageModel, setImageModel] = useState<"seedream-4.5" | "seedream-4.0">("seedream-4.5")
  const [styleType, setStyleType] = useState<"动漫" | "写实" | "电影">("写实")
  const [storyboardMode, setStoryboardMode] = useState<"首帧" | "首尾帧">("首帧")
  const [resolution, setResolution] = useState<"480p" | "720p" | "1080p">("1080p")
  const [durationSeconds, setDurationSeconds] = useState<string>("4")
  const [addModal, setAddModal] = useState<AddModalState>({ open: false, kind: "role" })
  const [previewImageSrcById, setPreviewImageSrcById] = useState<Record<string, string>>({})
  const [previewVideoSrcById, setPreviewVideoSrcById] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState<{
    title: string
    imageSrc: string
    generatedImageId?: string
    storyboardId?: string | null
    category?: string | null
    frameKind?: "first" | "last" | null
    description?: string | null
    prompt?: string | null
  } | null>(null)

  const initRef = useRef(false)

  useEffect(() => {
    if (!activeItem) return
    if (!initRef.current) initRef.current = true

    const rawImagePrompt = (activeItem.frames?.first?.prompt ?? "").slice(0, 1000)
    const nextImagePrompt = isAutoFallbackPrompt(rawImagePrompt) ? "" : rawImagePrompt
    const rawLastImagePrompt = (activeItem.frames?.last?.prompt ?? "").slice(0, 1000)
    const nextLastImagePrompt = isAutoFallbackPrompt(rawLastImagePrompt) ? "" : rawLastImagePrompt
    const nextVideoPrompt = ((activeItem.videoInfo?.prompt ?? "") || buildFallbackText(activeItem, "video")).slice(0, 1000)
    const nextHasVoice = Boolean(activeItem.videoInfo?.settings?.generateAudio)
    const nextCameraAngle = activeItem.shot_content.shoot.camera_movement ?? ""
    const bg = activeItem.shot_content.background
    const nextSceneText = bg.status ? `${bg.background_name}，${bg.status}` : bg.background_name
    const nextRoles = uniqueStrings(activeItem.shot_content.roles.filter((r) => r.role_name && r.role_name !== "旁白").map((r) => r.role_name))
    const nextRoleItems = uniqueStrings([...(activeItem.shot_content.role_items ?? []), ...(activeItem.shot_content.other_items ?? [])])
    const text = `${activeItem.storyboard_text ?? ""} ${(activeItem.frames?.first?.prompt ?? "")}`
    const nextStyleType = /anime|动漫/i.test(text) ? "动漫" : "写实"
    const nextStylePreset = /anime|动漫/i.test(text) ? "动漫插画" : "写实风格"
    const nextMode = normalizeStoryboardMode(activeItem.videoInfo?.settings?.mode) ?? "首帧"
    const nextDurationSeconds =
      typeof activeItem.videoInfo?.durationSeconds === "number" && Number.isFinite(activeItem.videoInfo.durationSeconds)
        ? String(Math.max(4, Math.min(12, Math.floor(activeItem.videoInfo.durationSeconds))))
        : "4"
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setImagePrompt(nextImagePrompt)
      setLastImagePrompt(nextLastImagePrompt)
      setVideoPrompt(nextVideoPrompt)
      setHasVoice(nextHasVoice)
      setCameraAngle(nextCameraAngle)
      setSceneText(nextSceneText)
      setRoles(nextRoles)
      setRoleItems(nextRoleItems)
      setStyleType(nextStyleType)
      setStylePreset(nextStylePreset)
      if (nextMode) setStoryboardMode(nextMode)
      setDurationSeconds(nextDurationSeconds)
    })

    if (typeof window !== "undefined" && storyId && outlineId) {
      const path = activeTab === "image" ? "/video/image" : "/video/video"
      window.history.replaceState(null, "", normalizeUrl({ path, storyboardId: activeItem.id, storyId, outlineId, sceneNo: activeItem.scene_no }))
    }

    return () => {
      cancelled = true
    }
  }, [activeItem, activeTab, outlineId, storyId])

  return {
    imagePrompt, setImagePrompt,
    lastImagePrompt, setLastImagePrompt,
    videoPrompt, setVideoPrompt,
    hasVoice, setHasVoice,
    stylePreset, setStylePreset,
    cameraAngle, setCameraAngle,
    sceneText, setSceneText,
    roles, setRoles,
    roleItems, setRoleItems,
    imageModel, setImageModel,
    styleType, setStyleType,
    storyboardMode, setStoryboardMode,
    resolution, setResolution,
    durationSeconds, setDurationSeconds,
    addModal, setAddModal,
    previewImageSrcById, setPreviewImageSrcById,
    previewVideoSrcById, setPreviewVideoSrcById,
    preview, setPreview
  }
}
