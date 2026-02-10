"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react"
import type { TvcPhaseId } from "@/features/tvc/types"
import type { TvcAgentStep } from "@/features/tvc/agent/types"

type MetaByIndex = Record<number, Record<string, string>>

function parseIndex(raw: unknown): number {
  const n = Number.parseInt(String(raw ?? "").replace(/[^\d]/g, ""), 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function collectIndices(assetUrlByKey: Record<string, string>, kind: string): number[] {
  const set = new Set<number>()
  const prefix = `${kind}:`
  for (const k of Object.keys(assetUrlByKey)) {
    if (!k.startsWith(prefix)) continue
    if (k.startsWith(`${prefix}meta:`)) continue
    const rest = k.slice(prefix.length)
    if (!rest) continue
    const idxRaw = rest.split(":", 1)[0]
    const idx = parseIndex(idxRaw)
    if (idx > 0) set.add(idx)
  }
  return Array.from(set).sort((a, b) => a - b)
}

function buildSig(params: {
  assetUrlByKey: Record<string, string>
  kind: string
  indices: number[]
  metaByIndex?: MetaByIndex
  metaKeys?: string[]
}): string {
  const parts: string[] = []
  for (const idx of params.indices) {
    const baseKey = `${params.kind}:${idx}`
    const v = String(params.assetUrlByKey[baseKey] ?? "")
    const orig = String(params.assetUrlByKey[`${baseKey}:orig`] ?? "")
    let metaPart = ""
    const meta = params.metaByIndex?.[idx]
    if (meta && params.metaKeys && params.metaKeys.length > 0) {
      const segs: string[] = []
      for (const k of params.metaKeys) {
        const mv = String(meta[k] ?? "").trim()
        if (mv) segs.push(`${k}=${mv}`)
      }
      if (segs.length > 0) metaPart = segs.join("&")
    }
    parts.push(`${idx}|${v}|${orig}|${metaPart}`)
  }
  return `${params.kind}=${parts.join("~")}`
}

function upsertStep(
  prev: Partial<Record<TvcPhaseId, TvcAgentStep>>,
  stepId: TvcPhaseId,
  titleFallback: string,
  contentPatch: Record<string, unknown>,
  allowOverrideNonAssets?: boolean
): Partial<Record<TvcPhaseId, TvcAgentStep>> {
  const existing = prev[stepId]
  const existingSource = (existing?.content as any)?.__source
  if (existing && existingSource !== "assets" && !allowOverrideNonAssets) return prev
  const next: TvcAgentStep = {
    id: stepId,
    title: existing?.title?.trim() ? existing.title : titleFallback,
    content: { ...(existing?.content ?? {}), ...contentPatch } as any
  }
  ;(next.content as any).__source = "assets"
  return { ...prev, [stepId]: next }
}

export function useTvcAssetDrivenStepsFromAssets(params: {
  assetUrlByKey: Record<string, string>
  setAgentPhaseById: Dispatch<SetStateAction<Partial<Record<TvcPhaseId, TvcAgentStep>>>>
}): { notifyAssets: (items: unknown[]) => void } {
  const { assetUrlByKey, setAgentPhaseById } = params
  const metaRefByKind = useRef<Record<string, MetaByIndex>>({
    reference_image: {},
    first_frame: {},
    video_clip: {},
    user_image: {}
  })
  const [metaRevision, setMetaRevision] = useState(0)
  const lastSigRef = useRef("")

  const notifyAssets = useCallback((items: unknown[]) => {
    if (!Array.isArray(items) || items.length === 0) return
    let changed = false
    for (const raw of items) {
      if (!raw || typeof raw !== "object") continue
      const rec = raw as Record<string, unknown>
      const kind = String(rec.kind ?? "").trim()
      if (!kind || !(kind in metaRefByKind.current)) continue
      const idx = parseIndex(rec.ordinal ?? rec.index ?? rec.assetOrdinal ?? rec.assetIndex)
      if (idx <= 0) continue
      const meta = (rec.meta ?? {}) as Record<string, unknown>
      const out: Record<string, string> = {}
      for (const [k, v] of Object.entries(meta)) {
        if (typeof v !== "string") continue
        const s = v.trim()
        if (!s) continue
        out[k] = s
      }
      if (Object.keys(out).length === 0) continue
      metaRefByKind.current[kind]![idx] = out
      changed = true
    }
    if (changed) setMetaRevision((v) => v + 1)
  }, [])

  const referenceIndices = useMemo(() => collectIndices(assetUrlByKey, "reference_image"), [assetUrlByKey])
  const firstFrameIndices = useMemo(() => collectIndices(assetUrlByKey, "first_frame"), [assetUrlByKey])
  const videoClipIndices = useMemo(() => collectIndices(assetUrlByKey, "video_clip"), [assetUrlByKey])

  useEffect(() => {
    if (referenceIndices.length === 0 && firstFrameIndices.length === 0 && videoClipIndices.length === 0) return
    const sig = [
      buildSig({
        assetUrlByKey,
        kind: "reference_image",
        indices: referenceIndices,
        metaByIndex: metaRefByKind.current.reference_image,
        metaKeys: ["category", "name", "description"]
      }),
      buildSig({
        assetUrlByKey,
        kind: "first_frame",
        indices: firstFrameIndices,
        metaByIndex: metaRefByKind.current.first_frame,
        metaKeys: ["description", "referenceImages"]
      }),
      buildSig({
        assetUrlByKey,
        kind: "video_clip",
        indices: videoClipIndices,
        metaByIndex: metaRefByKind.current.video_clip,
        metaKeys: ["title", "description", "durationSeconds", "duration_sec"]
      })
    ].join("||")
    if (!sig || sig === lastSigRef.current) return
    lastSigRef.current = sig

    setAgentPhaseById((prev) => {
      let next = prev

      if (referenceIndices.length > 0) {
        const images = referenceIndices
          .map((idx) => {
            const baseKey = `reference_image:${idx}`
            const url = String(assetUrlByKey[baseKey] ?? "").trim()
            const href = String(assetUrlByKey[`${baseKey}:orig`] ?? "").trim()
            const meta = metaRefByKind.current.reference_image?.[idx] ?? {}
            const rec: Record<string, string> = { ordinal: String(idx), index: String(idx) }
            if (url) rec.url = url
            if (href) rec.href = href
            if (meta.name) rec.name = meta.name
            if (meta.description) rec.description = meta.description
            if (meta.category) rec.category = meta.category
            return rec
          })
          .filter((it): it is Record<string, string> => Boolean(it && (it.url || it.href)))
        if (images.length > 0) next = upsertStep(next, "reference_image", "参考图", { images }, true)
      }

      if (firstFrameIndices.length > 0) {
        const images = firstFrameIndices
          .map((idx) => {
            const baseKey = `first_frame:${idx}`
            const url = String(assetUrlByKey[baseKey] ?? "").trim()
            const href = String(assetUrlByKey[`${baseKey}:orig`] ?? "").trim()
            const meta = metaRefByKind.current.first_frame?.[idx] ?? {}
            const rec: Record<string, string> = { ordinal: String(idx), index: String(idx) }
            if (url) rec.url = url
            if (href) rec.href = href
            if (meta.description) rec.description = meta.description
            return rec
          })
          .filter((it) => Boolean(it.url || it.href))
        if (images.length > 0) next = upsertStep(next, "first_frame", "分镜首帧", { images }, true)
      }

      if (videoClipIndices.length > 0) {
        const videoClips = videoClipIndices
          .map((idx) => {
            const baseKey = `video_clip:${idx}`
            const url = String(assetUrlByKey[`${baseKey}:orig`] ?? assetUrlByKey[baseKey] ?? "").trim()
            const meta = metaRefByKind.current.video_clip?.[idx] ?? {}
            const rec: Record<string, string> = { ordinal: String(idx), index: String(idx) }
            if (url) rec.url = url
            if (meta.title) rec.title = meta.title
            if (meta.description && !rec.title) rec.title = meta.description
            if (meta.durationSeconds) rec.durationSeconds = meta.durationSeconds
            if (meta.duration_sec && !rec.durationSeconds) rec.durationSeconds = meta.duration_sec
            return rec
          })
          .filter((it) => Boolean(it.url))
        if (videoClips.length > 0) next = upsertStep(next, "video_clip", "分镜视频", { videoClips }, true)
      }

      return next
    })
  }, [assetUrlByKey, firstFrameIndices, metaRevision, referenceIndices, setAgentPhaseById, videoClipIndices])

  return { notifyAssets }
}
