"use client"

import { useMemo, useState } from "react"
import type { TvcPhaseId } from "@/features/tvc/types"
import type { TvcAgentStep } from "@/features/tvc/agent/types"
import { extractAssetIndex } from "./extractAssetIndex"
import type { TimelineShot } from "@/features/tvc/components/TvcTimelinePanel"

export function useTvcShotsPreview(params: {
  shots: TimelineShot[]
  agentStepByCanvasId: Partial<Record<TvcPhaseId, TvcAgentStep>>
  assetUrlByKey: Record<string, string>
}): {
  displayShots: TimelineShot[]
  activeShot: TimelineShot | null
  selectedShotId: string | null
  setSelectedShotId: React.Dispatch<React.SetStateAction<string | null>>
} {
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null)

  const deriveShotsFromAgentStep = useMemo(() => {
    const parseSeq = (raw: unknown): number | null => {
      const s = String(raw ?? "").trim()
      if (!s) return null
      const n = Number.parseInt(s.replace(/[^\d]/g, ""), 10)
      return Number.isFinite(n) && n > 0 ? n : null
    }

    const normalizeKey = (k: unknown): string => {
      return String(k ?? "")
        .replace(/[\u00A0\s]+/g, "")
        .replace(/[：:]+$/g, "")
        .trim()
    }

    const buildTextFromRecord = (record: Record<string, string>): string => {
      const pick = (...keys: string[]) => {
        for (const k of keys) {
          const v = (record[k] ?? "").trim()
          if (v) return v
        }
        return ""
      }

      const lines: string[] = []
      const camera = pick("镜头类型", "镜头", "镜头类别", "shot_type", "type")
      const scene = pick("画面描述", "场景描述", "描述", "画面", "storyboard_text", "description", "内容")
      const action = pick("动作描述", "动作", "action", "action_description")
      const dialog = pick("台词/旁白", "台词", "旁白", "台词旁白", "dialogue", "voice_over", "voiceover", "旁白时间", "台词时间")
      const duration = pick("时长", "duration", "duration_sec", "durationSeconds", "秒")

      if (camera) lines.push(`镜头类型: ${camera}`)
      if (scene) lines.push(`画面描述: ${scene}`)
      if (action) lines.push(`动作描述: ${action}`)
      if (dialog) lines.push(`台词/旁白: ${dialog}`)
      if (duration) lines.push(`时长: ${duration}`)

      if (lines.length > 0) return lines.join("\n")

      return Object.entries(record)
        .filter(([, v]) => String(v ?? "").trim())
        .map(([k, v]) => `${k}: ${String(v ?? "").trim()}`)
        .join("\n")
    }

    return (step: TvcAgentStep | undefined | null): TimelineShot[] => {
      if (!step) return []
      const storyboards = step.content.storyboards ?? []
      if (Array.isArray(storyboards) && storyboards.length > 0) {
        return storyboards.map((r, idx) => {
          const anyRow = r as Record<string, unknown>
          const seqRaw = parseSeq(anyRow["sequence"]) ?? parseSeq(anyRow["shot"]) ?? parseSeq(anyRow["序号"]) ?? null
          const seq = seqRaw ?? idx + 1
          const text =
            String(anyRow["storyboard_text"] ?? anyRow["storyboardText"] ?? anyRow["画面描述"] ?? anyRow["description"] ?? anyRow["内容"] ?? "")
              .trim() || JSON.stringify(anyRow)
          return { id: `draft_sb_${idx}`, sequence: seq, storyboardText: text }
        })
      }

      const sections = step.content.sections ?? []
      if (!Array.isArray(sections) || sections.length === 0) return []
      return sections.map((sec, idx) => {
        const record: Record<string, string> = {}
        for (const f of sec.fields ?? []) {
          if (!f?.name) continue
          const key = normalizeKey(f.name)
          if (!key) continue
          record[key] = String(f.value ?? "").trim()
        }
        const fromName = parseSeq(sec.sectionName) ?? null
        const fromField = parseSeq(record["序号"] ?? record["shot"] ?? record["镜头"] ?? "") ?? null
        const seq = fromName ?? fromField ?? idx + 1
        const text = buildTextFromRecord(record)
        return { id: `draft_sec_${idx}`, sequence: seq, storyboardText: text, scriptContent: record }
      })
    }
  }, [])

  const firstFrameBySequence = useMemo(() => {
    const step4 = params.agentStepByCanvasId.first_frame
    const images = step4?.content?.images ?? []
    if (!Array.isArray(images) || images.length === 0) return new Map<number, { url: string; prompt: string }>()

    const map = new Map<number, { url: string; prompt: string }>()
    for (let idx = 0; idx < images.length; idx += 1) {
      const anyImg = images[idx] as Record<string, unknown>
      const index = extractAssetIndex(anyImg) ?? 0
      if (!Number.isFinite(index) || index <= 0) continue
      const url = String(anyImg["url"] ?? anyImg["URL"] ?? anyImg["href"] ?? params.assetUrlByKey[`first_frame:${index}`] ?? "").trim()
      if (!url) continue

      const prompt = String(anyImg["prompt"] ?? "").trim()
      const desc = String(anyImg["description"] ?? "").trim()
      const m = desc.match(/(?:shot|镜头)\s*0*([0-9]+)/i)
      const seq = m?.[1] ? Number.parseInt(m[1] ?? "", 10) : idx + 1
      if (Number.isFinite(seq) && seq > 0 && !map.has(seq)) map.set(seq, { url, prompt })
    }
    return map
  }, [params.agentStepByCanvasId, params.assetUrlByKey])

  const videoBySequence = useMemo(() => {
    const step5 = params.agentStepByCanvasId.video_clip
    const clips = step5?.content?.videoClips ?? []
    if (!Array.isArray(clips) || clips.length === 0) return new Map<number, { url: string; prompt: string; durationSeconds?: number }>()

    const parseDuration = (raw: unknown): number | null => {
      if (typeof raw === "number" && Number.isFinite(raw)) return Math.trunc(raw)
      const s = String(raw ?? "").trim()
      if (!s) return null
      const n = Number.parseInt(s.replace(/[^\d]/g, ""), 10)
      return Number.isFinite(n) && n > 0 ? n : null
    }

    const map = new Map<number, { url: string; prompt: string; durationSeconds?: number }>()
    for (let idx = 0; idx < clips.length; idx += 1) {
      const anyClip = clips[idx] as Record<string, unknown>
      const index = extractAssetIndex(anyClip) ?? 0
      if (!Number.isFinite(index) || index <= 0) continue
      const url = String(anyClip["url"] ?? anyClip["video_url"] ?? anyClip["href"] ?? params.assetUrlByKey[`video_clip:${index}`] ?? "").trim()
      if (!url) continue
      const prompt = String(anyClip["prompt"] ?? "").trim()
      const durationSeconds = parseDuration(anyClip["duration"] ?? anyClip["duration_sec"] ?? anyClip["durationSeconds"]) ?? undefined
      const fromDesc = (() => {
        const d = String(anyClip["title"] ?? anyClip["description"] ?? "").trim()
        const m = d.match(/(?:shot|镜头)\s*0*([0-9]+)/i)
        return m ? Number.parseInt(m[1] ?? "", 10) : null
      })()
      const seq = (fromDesc ?? idx + 1) as number
      if (!map.has(seq)) map.set(seq, { url, prompt, durationSeconds })
    }
    return map
  }, [params.agentStepByCanvasId, params.assetUrlByKey])

  const previewShots = useMemo(() => {
    if (params.shots.length > 0) return params.shots
    const fromScript = deriveShotsFromAgentStep(params.agentStepByCanvasId.storyboard)
    if (fromScript.length > 0) return fromScript
    const fromDesign = deriveShotsFromAgentStep(params.agentStepByCanvasId.script)
    if (fromDesign.length > 0) return fromDesign
    return params.shots
  }, [deriveShotsFromAgentStep, params.agentStepByCanvasId, params.shots])

  const displayShots = useMemo(() => {
    return previewShots.map((s) => {
      const first = firstFrameBySequence.get(s.sequence)
      const video = videoBySequence.get(s.sequence)
      const hasFirstUrl = Boolean((s as any).frames?.first?.url)
      const hasVideoUrl = Boolean((s as any).videoInfo?.url)
      if (!first && !video) return s
      return {
        ...s,
        ...(first && !hasFirstUrl
          ? {
              frames: {
                ...((s as any).frames ?? {}),
                first: { url: first.url, prompt: first.prompt }
              }
            }
          : null),
        ...(video && !hasVideoUrl
          ? {
              videoInfo: {
                ...((s as any).videoInfo ?? {}),
                url: video.url,
                prompt: video.prompt,
                ...(video.durationSeconds ? { durationSeconds: video.durationSeconds } : {})
              }
            }
          : null)
      } as TimelineShot
    })
  }, [firstFrameBySequence, previewShots, videoBySequence])

  const effectiveSelectedShotId = useMemo(() => {
    if (selectedShotId && displayShots.some((s) => s.id === selectedShotId)) return selectedShotId
    return displayShots[0]?.id ?? null
  }, [displayShots, selectedShotId])

  const activeShot = useMemo(() => {
    if (!effectiveSelectedShotId) return null
    return displayShots.find((s) => s.id === effectiveSelectedShotId) ?? null
  }, [displayShots, effectiveSelectedShotId])

  return { displayShots, activeShot, selectedShotId: effectiveSelectedShotId, setSelectedShotId }
}
