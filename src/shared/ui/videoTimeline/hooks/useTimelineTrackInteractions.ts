import { useCallback, useEffect, useRef } from "react"
import { MIN_CLIP_SECONDS, TRACK_OFFSET_PX, clamp, type AudioClip, type VideoClip } from "@/shared/utils/timelineUtils"

type SelectedKey = { type: "video" | "audio"; id: string }
type PointerLike = {
  clientX: number
  pointerId?: number
  pointerType?: string
  shiftKey?: boolean
  metaKey?: boolean
  ctrlKey?: boolean
}

const makeKey = (type: "video" | "audio", id: string): SelectedKey => ({ type, id })

export function useTimelineTrackInteractions(params: {
  videoClips: VideoClip[]
  audioClips: AudioClip[]
  markers: number[]
  pxPerSecond: number
  wrapRef: React.RefObject<HTMLDivElement>
  keyboardScopeRef: React.RefObject<HTMLDivElement>
  isInteractingRef?: React.RefObject<boolean>
  setSelectedClips: React.Dispatch<React.SetStateAction<SelectedKey[]>>
  updateVideoClip: (id: string, patch: Partial<VideoClip>) => void
  updateVideoClipsBulk?: (patches: Array<{ id: string; patch: Partial<VideoClip> }>) => void
  updateAudioClip: (id: string, patch: Partial<AudioClip>) => void
  onSelectSegment: (id: string) => void
  onSeekPlayheadSeconds?: (seconds: number) => void
}): { onVideoTrackPointerDown: (e: PointerLike) => void; onAudioTrackPointerDown: (e: PointerLike) => void } {
  const {
    videoClips,
    audioClips,
    markers,
    pxPerSecond,
    wrapRef,
    keyboardScopeRef,
    isInteractingRef,
    setSelectedClips,
    updateVideoClip,
    updateVideoClipsBulk,
    updateAudioClip,
    onSelectSegment,
    onSeekPlayheadSeconds
  } = params

  const latestVideoRef = useRef(videoClips)
  const latestAudioRef = useRef(audioClips)
  useEffect(() => {
    latestVideoRef.current = videoClips
  }, [videoClips])
  useEffect(() => {
    latestAudioRef.current = audioClips
  }, [audioClips])

  const selectionRef = useRef<SelectedKey[]>([])
  const setSelection = useCallback(
    (next: SelectedKey[]) => {
      selectionRef.current = next
      setSelectedClips(next)
    },
    [setSelectedClips]
  )

  const getSecondsAtClientX = useCallback(
    (clientX: number) => {
      const wrap = wrapRef.current
      if (!wrap) return 0
      const rect = wrap.getBoundingClientRect()
      const x = clientX - rect.left + wrap.scrollLeft - TRACK_OFFSET_PX
      return x / pxPerSecond
    },
    [pxPerSecond, wrapRef]
  )

  const findVideoHit = useCallback(
    (seconds: number) => {
      const list = latestVideoRef.current
      const s = Number(seconds)
      if (!Number.isFinite(s)) return null
      const thresholdSeconds = 8 / pxPerSecond
      for (const c of list) {
        const vs = c.start + Math.max(0, c.trimStart)
        const ve = c.start + c.duration - Math.max(0, c.trimEnd)
        if (s < vs || s > ve) continue
        const edge: "start" | "end" | null = Math.abs(s - vs) <= thresholdSeconds ? "start" : Math.abs(ve - s) <= thresholdSeconds ? "end" : null
        return { clip: c, visibleStart: vs, visibleEnd: ve, edge }
      }
      return null
    },
    [pxPerSecond]
  )

  const findAudioHit = useCallback(
    (seconds: number) => {
      const list = latestAudioRef.current
      const s = Number(seconds)
      if (!Number.isFinite(s)) return null
      for (const c of list) {
        const vs = c.start
        const ve = c.start + c.duration
        if (s < vs || s > ve) continue
        return { clip: c }
      }
      return null
    },
    []
  )

  const beginVideoDrag = useCallback(
    (e: PointerLike, hit: { clip: VideoClip; visibleStart: number; visibleEnd: number; edge: "start" | "end" | null }) => {
      keyboardScopeRef.current?.focus()

      const pointerId = typeof e.pointerId === "number" ? e.pointerId : null
      if (isInteractingRef) isInteractingRef.current = true

      const clip = hit.clip
      const wrap = wrapRef.current
      const rectLeft = wrap?.getBoundingClientRect().left ?? 0
      const getSecondsFast = (clientX: number) => {
        const el = wrapRef.current
        if (!el) return 0
        const x = clientX - rectLeft + el.scrollLeft - TRACK_OFFSET_PX
        return x / pxPerSecond
      }
      const startSeconds = getSecondsFast(e.clientX)
      const EPS = 1e-3
      const initialById = new Map<string, VideoClip>()
      for (const c of latestVideoRef.current) initialById.set(c.id, c)

      const selection0 = selectionRef.current
      const isInSelection = selection0.some((s) => s.type === "video" && s.id === clip.id)
      const selectedVideoIds = isInSelection ? selection0.filter((s) => s.type === "video").map((s) => s.id) : [clip.id]
      if (!isInSelection) setSelection([makeKey("video", clip.id)])
      onSelectSegment(clip.segmentId)

      const mode = hit.edge === "start" ? "trimStart" : hit.edge === "end" ? "trimEnd" : "move"
      const snapThresholdSeconds = 8 / pxPerSecond

      const moveCtx =
        mode === "move"
          ? (() => {
              const epsMove = 1 / pxPerSecond
              const selectedSet = new Set(selectedVideoIds)
              const allClips = latestVideoRef.current
              const selected = allClips.filter((c) => selectedSet.has(c.id))
              if (!selected.length) return null

              const startOf = (c: VideoClip) => initialById.get(c.id)?.start ?? c.start
              const toVisible = (c: VideoClip) => {
                const start0 = startOf(c)
                return {
                  id: c.id,
                  start0,
                  trimStart: Math.max(0, c.trimStart),
                  visibleStart: start0 + Math.max(0, c.trimStart),
                  visibleEnd: start0 + c.duration - Math.max(0, c.trimEnd)
                }
              }

              const selectedVisible = selected.map(toVisible)
              const groupStart0 = Math.min(...selectedVisible.map((c) => c.visibleStart))
              const groupEnd0 = Math.max(...selectedVisible.map((c) => c.visibleEnd))

              const othersVisible = allClips.filter((c) => !selectedSet.has(c.id)).map(toVisible)
              const leftSide = othersVisible.filter((c) => c.visibleEnd <= groupStart0 + epsMove)
              const rightCandidates = othersVisible.filter((c) => c.visibleStart >= groupStart0 - epsMove)
              const movedRipple = [...selectedVisible, ...rightCandidates]

              let minDeltaNoRipple = Math.max(...selectedVisible.map((c) => -c.trimStart - c.start0))
              if (leftSide.length > 0) {
                minDeltaNoRipple = Math.max(minDeltaNoRipple, Math.max(...leftSide.map((c) => c.visibleEnd)) - groupStart0)
              }

              let maxDeltaNoRipple = Number.POSITIVE_INFINITY
              if (rightCandidates.length > 0) {
                const nextStart = Math.min(...rightCandidates.map((c) => c.visibleStart))
                maxDeltaNoRipple = Math.min(maxDeltaNoRipple, Math.max(0, nextStart - groupEnd0))
              }

              let minDeltaRipple = Math.max(...movedRipple.map((c) => -c.trimStart - c.start0))
              if (leftSide.length > 0) {
                minDeltaRipple = Math.max(minDeltaRipple, Math.max(...leftSide.map((c) => c.visibleEnd)) - groupStart0)
              }

              const anchorsAll: number[] = [0, ...markers]
              for (const other of othersVisible) {
                anchorsAll.push(other.visibleStart)
                anchorsAll.push(other.visibleEnd)
              }

              const anchorsLeft: number[] = [0, ...markers]
              for (const other of leftSide) {
                anchorsLeft.push(other.visibleStart)
                anchorsLeft.push(other.visibleEnd)
              }

              return {
                groupStart0,
                groupEnd0,
                selectedCount: selectedVisible.length,
                noRipple: {
                  minDelta: minDeltaNoRipple,
                  maxDelta: maxDeltaNoRipple,
                  anchors: anchorsAll,
                  targets: selectedVisible.map((c) => ({ id: c.id, start0: c.start0 }))
                },
                ripple: {
                  minDelta: minDeltaRipple,
                  maxDelta: Number.POSITIVE_INFINITY,
                  anchors: anchorsLeft,
                  targets: movedRipple.map((c) => ({ id: c.id, start0: c.start0 }))
                },
                rightTargets: rightCandidates.map((c) => ({ id: c.id, start0: c.start0 }))
              }
            })()
          : null

      let raf = 0
      let lastClientX = e.clientX
      let lastMoveMode: "ripple" | "noRipple" = "noRipple"
      const applyFrame = () => {
        raf = 0
        const nowSeconds = getSecondsFast(lastClientX)
        const dx = nowSeconds - startSeconds


        if (mode === "trimStart") {
          const cur = initialById.get(clip.id)
          if (!cur) return
          const others = latestVideoRef.current
            .filter((c) => c.id !== clip.id)
            .map((c) => ({ visibleStart: c.start + Math.max(0, c.trimStart), visibleEnd: c.start + c.duration - Math.max(0, c.trimEnd) }))
            .filter((c) => c.visibleEnd > c.visibleStart + EPS)
            .sort((a, b) => a.visibleStart - b.visibleStart)
          const curVisibleStart = cur.start + Math.max(0, cur.trimStart)
          const insertAt = (() => {
            const idx = others.findIndex((c) => c.visibleStart > curVisibleStart)
            return idx === -1 ? others.length : idx
          })()
          const prevEnd = insertAt > 0 ? others[insertAt - 1]?.visibleEnd ?? 0 : 0
          const minTrimStartByOverlap = Math.max(0, prevEnd - cur.start, -cur.start)
          const maxTrimStart = cur.duration - Math.max(0, cur.trimEnd) - MIN_CLIP_SECONDS
          if (minTrimStartByOverlap > maxTrimStart) return
          const next = clamp(Math.max(0, cur.trimStart) + dx, minTrimStartByOverlap, maxTrimStart)
          updateVideoClip(cur.id, { trimStart: next })
          onSeekPlayheadSeconds?.(Math.max(0, cur.start + next))
          return
        }

        if (mode === "trimEnd") {
          const cur = initialById.get(clip.id)
          if (!cur) return
          const others = latestVideoRef.current
            .filter((c) => c.id !== clip.id)
            .map((c) => ({ visibleStart: c.start + Math.max(0, c.trimStart), visibleEnd: c.start + c.duration - Math.max(0, c.trimEnd) }))
            .filter((c) => c.visibleEnd > c.visibleStart + EPS)
            .sort((a, b) => a.visibleStart - b.visibleStart)
          const curVisibleStart = cur.start + Math.max(0, cur.trimStart)
          const insertAt = (() => {
            const idx = others.findIndex((c) => c.visibleStart > curVisibleStart)
            return idx === -1 ? others.length : idx
          })()
          const nextStart = insertAt < others.length ? others[insertAt]?.visibleStart ?? Number.POSITIVE_INFINITY : Number.POSITIVE_INFINITY
          const minTrimEndByOverlap = Number.isFinite(nextStart) ? Math.max(0, cur.start + cur.duration - nextStart) : 0
          const maxTrimEnd = cur.duration - Math.max(0, cur.trimStart) - MIN_CLIP_SECONDS
          if (minTrimEndByOverlap > maxTrimEnd) return
          const next = clamp(Math.max(0, cur.trimEnd) - dx, minTrimEndByOverlap, maxTrimEnd)
          updateVideoClip(cur.id, { trimEnd: next })
          onSeekPlayheadSeconds?.(Math.max(0, cur.start + cur.duration - next))
          return
        }

        if (!moveCtx) return
        if (moveCtx.selectedCount <= 1 && dx > 0) {
          const ctx = moveCtx.ripple
          const baseDelta = dx
          const snappedDelta = (() => {
            const afterStart = moveCtx.groupStart0 + baseDelta
            const afterEnd = moveCtx.groupEnd0 + baseDelta
            let best: number | null = null
            let bestAbs = Number.POSITIVE_INFINITY
            for (const a of ctx.anchors) {
              const d1 = a - afterStart
              if (Math.abs(d1) <= snapThresholdSeconds && Math.abs(d1) < bestAbs) {
                bestAbs = Math.abs(d1)
                best = baseDelta + d1
              }
              const d2 = a - afterEnd
              if (Math.abs(d2) <= snapThresholdSeconds && Math.abs(d2) < bestAbs) {
                bestAbs = Math.abs(d2)
                best = baseDelta + d2
              }
            }
            return best
          })()
          const deltaSelected = snappedDelta ?? baseDelta
          const overflow = Number.isFinite(moveCtx.noRipple.maxDelta) ? Math.max(0, deltaSelected - moveCtx.noRipple.maxDelta) : 0
          const patches = [
            ...moveCtx.noRipple.targets.map((t) => ({ id: t.id, patch: { start: t.start0 + deltaSelected } })),
            ...moveCtx.rightTargets.map((t) => ({ id: t.id, patch: { start: t.start0 + overflow } }))
          ]
          if (updateVideoClipsBulk) updateVideoClipsBulk(patches)
          else for (const p of patches) updateVideoClip(p.id, p.patch)
          return
        }
        const deadzoneSeconds = 2 / pxPerSecond
        const desiredMode: "ripple" | "noRipple" =
          dx < 0
            ? "ripple"
            : moveCtx.selectedCount <= 1
              ? dx > moveCtx.noRipple.maxDelta - deadzoneSeconds
                ? "ripple"
                : "noRipple"
              : "noRipple"
        if (Math.abs(dx) > deadzoneSeconds) {
          lastMoveMode = desiredMode
        }
        const ctx = lastMoveMode === "ripple" ? moveCtx.ripple : moveCtx.noRipple
        const baseDelta = clamp(dx, ctx.minDelta, ctx.maxDelta)

        const snappedDelta = (() => {
          const afterStart = moveCtx.groupStart0 + baseDelta
          const afterEnd = moveCtx.groupEnd0 + baseDelta
          let best: number | null = null
          let bestAbs = Number.POSITIVE_INFINITY
          for (const a of ctx.anchors) {
            const d1 = a - afterStart
            if (Math.abs(d1) <= snapThresholdSeconds && Math.abs(d1) < bestAbs) {
              bestAbs = Math.abs(d1)
              best = baseDelta + d1
            }
            const d2 = a - afterEnd
            if (Math.abs(d2) <= snapThresholdSeconds && Math.abs(d2) < bestAbs) {
              bestAbs = Math.abs(d2)
              best = baseDelta + d2
            }
          }
          return best
        })()

        const actualDelta = clamp(snappedDelta ?? baseDelta, ctx.minDelta, ctx.maxDelta)
        if (updateVideoClipsBulk) {
          updateVideoClipsBulk(ctx.targets.map((t) => ({ id: t.id, patch: { start: t.start0 + actualDelta } })))
        } else {
          for (const t of ctx.targets) {
            updateVideoClip(t.id, { start: t.start0 + actualDelta })
          }
        }
      }

      const onMove = (ev: PointerEvent) => {
        if (pointerId !== null && ev.pointerId !== pointerId) return
        lastClientX = ev.clientX
        if (raf) return
        raf = window.requestAnimationFrame(applyFrame)
      }

      const onUp = (ev: PointerEvent) => {
        if (pointerId !== null && ev.pointerId !== pointerId) return
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("pointerup", onUp)
        window.removeEventListener("pointercancel", onUp)
        if (raf) window.cancelAnimationFrame(raf)
        raf = 0
        if (isInteractingRef) isInteractingRef.current = false
      }

      window.addEventListener("pointermove", onMove)
      window.addEventListener("pointerup", onUp)
      window.addEventListener("pointercancel", onUp)
    },
    [isInteractingRef, keyboardScopeRef, markers, onSeekPlayheadSeconds, onSelectSegment, pxPerSecond, setSelection, updateVideoClip, updateVideoClipsBulk, wrapRef]
  )

  const beginAudioDrag = useCallback(
    (e: PointerLike, hit: { clip: AudioClip }) => {
      keyboardScopeRef.current?.focus()

      const pointerId = typeof e.pointerId === "number" ? e.pointerId : null
      if (isInteractingRef) isInteractingRef.current = true

      const clip = hit.clip
      const wrap = wrapRef.current
      const rectLeft = wrap?.getBoundingClientRect().left ?? 0
      const getSecondsFast = (clientX: number) => {
        const el = wrapRef.current
        if (!el) return 0
        const x = clientX - rectLeft + el.scrollLeft - TRACK_OFFSET_PX
        return x / pxPerSecond
      }
      const startSeconds = getSecondsFast(e.clientX)

      const selection0 = selectionRef.current
      const isInSelection = selection0.some((s) => s.type === "audio" && s.id === clip.id)
      const selectedAudioIds = isInSelection ? selection0.filter((s) => s.type === "audio").map((s) => s.id) : [clip.id]
      if (!isInSelection) setSelection([makeKey("audio", clip.id)])

      const initialStartById = new Map<string, number>()
      for (const c of latestAudioRef.current) {
        if (selectedAudioIds.includes(c.id)) initialStartById.set(c.id, c.start)
      }

      let raf = 0
      let lastClientX = e.clientX

      const applyFrame = () => {
        raf = 0
        const nowSeconds = getSecondsFast(lastClientX)
        const dx = nowSeconds - startSeconds
        const ids = selectedAudioIds
        if (ids.length <= 1) {
          const next = clamp((initialStartById.get(clip.id) ?? clip.start) + dx, 0, Number.POSITIVE_INFINITY)
          updateAudioClip(clip.id, { start: next })
          return
        }
        const minDelta = Math.max(...ids.map((id) => -(initialStartById.get(id) ?? 0)))
        const actual = Math.max(dx, minDelta)
        for (const id of ids) {
          const start0 = initialStartById.get(id)
          if (typeof start0 !== "number") continue
          updateAudioClip(id, { start: Math.max(0, start0 + actual) })
        }
      }

      const onMove = (ev: PointerEvent) => {
        if (pointerId !== null && ev.pointerId !== pointerId) return
        lastClientX = ev.clientX
        if (raf) return
        raf = window.requestAnimationFrame(applyFrame)
      }

      const onUp = (ev: PointerEvent) => {
        if (pointerId !== null && ev.pointerId !== pointerId) return
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("pointerup", onUp)
        window.removeEventListener("pointercancel", onUp)
        if (raf) window.cancelAnimationFrame(raf)
        raf = 0
        if (isInteractingRef) isInteractingRef.current = false
      }

      window.addEventListener("pointermove", onMove)
      window.addEventListener("pointerup", onUp)
      window.addEventListener("pointercancel", onUp)
    },
    [isInteractingRef, keyboardScopeRef, pxPerSecond, setSelection, updateAudioClip, wrapRef]
  )

  const onVideoTrackPointerDown = useCallback(
    (e: PointerLike) => {
      const seconds = getSecondsAtClientX(e.clientX)
      const hit = findVideoHit(seconds)
      if (!hit) {
        if (!e.shiftKey && !e.metaKey && !e.ctrlKey) setSelection([])
        return
      }
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        const prev = selectionRef.current
        const idx = prev.findIndex((s) => s.type === "video" && s.id === hit.clip.id)
        const next = idx >= 0 ? [...prev.slice(0, idx), ...prev.slice(idx + 1)] : [makeKey("video", hit.clip.id), ...prev]
        setSelection(next)
        return
      }
      beginVideoDrag(e, hit)
    },
    [beginVideoDrag, findVideoHit, getSecondsAtClientX, setSelection]
  )

  const onAudioTrackPointerDown = useCallback(
    (e: PointerLike) => {
      const seconds = getSecondsAtClientX(e.clientX)
      const hit = findAudioHit(seconds)
      if (!hit) {
        if (!e.shiftKey && !e.metaKey && !e.ctrlKey) setSelection([])
        return
      }
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        const prev = selectionRef.current
        const idx = prev.findIndex((s) => s.type === "audio" && s.id === hit.clip.id)
        const next = idx >= 0 ? [...prev.slice(0, idx), ...prev.slice(idx + 1)] : [makeKey("audio", hit.clip.id), ...prev]
        setSelection(next)
        return
      }
      beginAudioDrag(e, hit)
    },
    [beginAudioDrag, findAudioHit, getSecondsAtClientX, setSelection]
  )

  return { onVideoTrackPointerDown, onAudioTrackPointerDown }
}
