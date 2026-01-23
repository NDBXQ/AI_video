import { useState, useMemo } from "react"
import type { StoryboardItem } from "../types"
import { extractVideoScript } from "../utils/storyboardUtils"

type ScriptGenerateTone = "info" | "warn" | "error"
export type ScriptGenerateState = { status: "idle" | "generating" | "success" | "error"; tone?: ScriptGenerateTone; message?: string }

type UseScriptGenerationProps = {
  items: StoryboardItem[]
  updateItemById: (id: string, updater: (item: StoryboardItem) => StoryboardItem) => void
}

export function useScriptGeneration({ items, updateItemById }: UseScriptGenerationProps) {
  const [scriptGenerateById, setScriptGenerateById] = useState<Record<string, ScriptGenerateState>>({})

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

  const generateScriptForItem = async (item: StoryboardItem) => {
    const raw = item.storyboard_text?.trim() ?? ""
    if (!raw) {
      setScriptGenerateById((prev) => ({
        ...prev,
        [item.id]: { status: "error", tone: "error", message: "分镜描述为空，无法生成" }
      }))
      return null
    }

    setScriptGenerateById((prev) => ({
      ...prev,
      [item.id]: { status: "generating", tone: "info", message: "脚本生成中…" }
    }))

    try {
      const res = await fetch("/api/coze/storyboard/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_script: raw, storyboardId: item.id })
      })
      const json = (await res.json()) as { ok: boolean; data?: unknown; error?: { message?: string } }
      if (!res.ok || !json?.ok || !json.data) throw new Error(json?.error?.message ?? `HTTP ${res.status}`)

      const videoScript = extractVideoScript(json.data)
      if (!videoScript) throw new Error("接口返回缺少 video_script")

      const safeString = (value: unknown) => (typeof value === "string" ? value : "")
      const safeNumber = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0)
      const safeStringArray = (value: unknown) =>
        Array.isArray(value) ? value.filter((v) => typeof v === "string") as string[] : []

      const shot = videoScript["shot"]
      const anyShot = shot && typeof shot === "object" ? (shot as Record<string, unknown>) : {}

      const rawShotContent = videoScript["shot_content"]
      const anyShotContent = rawShotContent && typeof rawShotContent === "object" ? (rawShotContent as Record<string, unknown>) : {}

      const rawBackground = anyShotContent["background"]
      const anyBackground = rawBackground && typeof rawBackground === "object" ? (rawBackground as Record<string, unknown>) : {}

      const rawShoot = anyShotContent["shoot"]
      const anyShoot = rawShoot && typeof rawShoot === "object" ? (rawShoot as Record<string, unknown>) : {}

      const rawRoles = anyShotContent["roles"]
      const roles =
        Array.isArray(rawRoles)
          ? rawRoles
              .filter((r) => r && typeof r === "object")
              .map((r) => {
                const anyRole = r as Record<string, unknown>
                const rawSpeak = anyRole["speak"]
                const anySpeak = rawSpeak && typeof rawSpeak === "object" ? (rawSpeak as Record<string, unknown>) : null
                const speak =
                  anySpeak
                    ? {
                        time_point: safeNumber(anySpeak["time_point"]),
                        tone: safeString(anySpeak["tone"]),
                        content: safeString(anySpeak["content"]),
                        speed: safeNumber(anySpeak["speed"]),
                        emotion: safeString(anySpeak["emotion"])
                      }
                    : null
                return {
                  role_name: safeString(anyRole["role_name"]),
                  appearance_time_point: safeNumber(anyRole["appearance_time_point"]),
                  location_info: safeString(anyRole["location_info"]),
                  action: safeString(anyRole["action"]),
                  expression: safeString(anyRole["expression"]),
                  speak
                }
              })
          : []

      const patchShotInfo = {
        shot_duration: safeNumber(anyShot["shot_duration"]),
        cut_to: item.shot_info.cut_to,
        shot_style: safeString(anyShot["shot_style"])
      }

      const patchShotContent = {
        background: {
          background_name: safeString(anyBackground["background_name"]),
          status: safeString(anyBackground["status"])
        },
        roles,
        role_items: safeStringArray(anyShotContent["role_items"]),
        other_items: safeStringArray(anyShotContent["other_items"]),
        shoot: {
          shot_angle: safeString(anyShoot["shot_angle"]),
          angle: safeString(anyShoot["angle"]),
          camera_movement: safeString(anyShoot["camera_movement"]),
          composition: safeString(anyShoot["composition"])
        },
        bgm: safeString(anyShotContent["bgm"])
      }

      updateItemById(item.id, (it) => ({
        ...it,
        shot_info: patchShotInfo,
        shot_content: patchShotContent,
        scriptContent: json.data,
        videoInfo: {
          ...(it.videoInfo ?? {}),
          durationSeconds: patchShotInfo.shot_duration > 0 ? Math.trunc(patchShotInfo.shot_duration) : it.videoInfo?.durationSeconds
        }
      }))

      setScriptGenerateById((prev) => ({
        ...prev,
        [item.id]: { status: "success", tone: "info", message: "已生成" }
      }))

      return json.data

    } catch (e) {
      const anyErr = e as { message?: string }
      setScriptGenerateById((prev) => ({
        ...prev,
        [item.id]: { status: "error", tone: "error", message: anyErr?.message ? `生成失败：${anyErr.message}` : "生成失败" }
      }))
      return null
    }
  }

  const scriptGenerateSummary = useMemo(() => {
    const activeStates = items
      .map((it) => scriptGenerateById[it.id])
      .filter((st): st is ScriptGenerateState => Boolean(st && st.status !== "idle"))
    const total = activeStates.length
    const generating = activeStates.filter((st) => st.status === "generating").length
    const done = total - generating
    return { total, generating, done }
  }, [items, scriptGenerateById])

  const isAnyScriptGenerating = scriptGenerateSummary.generating > 0

  return {
    scriptGenerateById,
    setScriptGenerateById,
    generateScriptForItem,
    runTasksWithConcurrency,
    scriptGenerateSummary,
    isAnyScriptGenerating
  }
}
