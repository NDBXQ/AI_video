import { useCallback, type RefObject } from "react"
import { MIN_CLIP_SECONDS, clamp, type AudioClip, type DraggedClip, type VideoClip } from "@/shared/utils/timelineUtils"

export function useTimelineClipInteractions(params: {
  latestVideoClipsRef: RefObject<VideoClip[]>
  latestAudioClipsRef: RefObject<AudioClip[]>
  latestSelectedClipsRef: RefObject<Array<{ type: "video" | "audio"; id: string }>>
  isInteractingRef: RefObject<boolean>
  pxPerSecond: number
  keyboardScopeRef: RefObject<HTMLDivElement>
  setSelectedClips: React.Dispatch<React.SetStateAction<Array<{ type: "video" | "audio"; id: string }>>>
  updateVideoClip: (id: string, patch: Partial<VideoClip>) => void
  updateAudioClip: (id: string, patch: Partial<AudioClip>) => void
  onSelectSegment: (id: string) => void
  markers: number[]
  onSeekPlayheadSeconds?: (seconds: number) => void
  beginDragOut: (clips: DraggedClip[], start: { x: number; y: number }, sourceEl?: HTMLElement | null, pointerId?: number, pointerType?: string) => void
}): {
  makeTrimHandler: (clip: VideoClip, edge: "start" | "end") => (e: React.PointerEvent) => void
  makeDragHandler: (clip: VideoClip) => (e: React.PointerEvent) => void
  makeAudioDragHandler: (clip: AudioClip) => (e: React.PointerEvent) => void
  onClipClick: (e: React.MouseEvent, type: "video" | "audio", id: string, segmentId?: string) => void
} {
  const {
    latestVideoClipsRef,
    latestAudioClipsRef,
    latestSelectedClipsRef,
    isInteractingRef,
    pxPerSecond,
    keyboardScopeRef,
    setSelectedClips,
    updateVideoClip,
    updateAudioClip,
    onSelectSegment,
    markers,
    onSeekPlayheadSeconds,
    beginDragOut
  } = params

  const setSingleSelected = useCallback(
    (type: "video" | "audio", id: string) => {
      setSelectedClips([{ type, id }])
    },
    [setSelectedClips]
  )

  const toggleSelected = useCallback(
    (type: "video" | "audio", id: string) => {
      setSelectedClips((prev) => {
        const idx = prev.findIndex((s) => s.type === type && s.id === id)
        if (idx >= 0) {
          const next = [...prev.slice(0, idx), ...prev.slice(idx + 1)]
          return next
        }
        return [{ type, id }, ...prev]
      })
    },
    [setSelectedClips]
  )

  const makeTrimHandler = useCallback(
    (clip: VideoClip, edge: "start" | "end") => {
      return (e: React.PointerEvent) => {
        e.preventDefault()
        e.stopPropagation()
        isInteractingRef.current = true
        setSingleSelected("video", clip.id)
        keyboardScopeRef.current?.focus()
        onSelectSegment(clip.segmentId)
        const startX = e.clientX
        const initialTrimStart = clip.trimStart
        const initialTrimEnd = clip.trimEnd
        const onMove = (ev: PointerEvent) => {
          const EPS = 1e-3
          const others = latestVideoClipsRef.current
            .filter((c) => c.id !== clip.id)
            .map((c) => ({
              visibleStart: c.start + Math.max(0, c.trimStart),
              visibleEnd: c.start + c.duration - Math.max(0, c.trimEnd)
            }))
            .filter((c) => c.visibleEnd > c.visibleStart + EPS)
            .sort((a, b) => a.visibleStart - b.visibleStart)

          const curVisibleStart = clip.start + Math.max(0, clip.trimStart)
          const insertAt = (() => {
            const idx = others.findIndex((c) => c.visibleStart > curVisibleStart)
            return idx === -1 ? others.length : idx
          })()
          const prevEnd = insertAt > 0 ? others[insertAt - 1]?.visibleEnd ?? 0 : 0
          const nextStart = insertAt < others.length ? others[insertAt]?.visibleStart ?? Number.POSITIVE_INFINITY : Number.POSITIVE_INFINITY

          const dx = (ev.clientX - startX) / pxPerSecond
          if (edge === "start") {
            const minTrimStartByOverlap = Math.max(0, prevEnd - clip.start, -clip.start)
            const maxTrimStart = clip.duration - initialTrimEnd - MIN_CLIP_SECONDS
            if (minTrimStartByOverlap > maxTrimStart) return
            const next = clamp(initialTrimStart + dx, minTrimStartByOverlap, maxTrimStart)
            updateVideoClip(clip.id, { trimStart: next })
            onSeekPlayheadSeconds?.(Math.max(0, clip.start + next))
          } else {
            const minTrimEndByOverlap = Number.isFinite(nextStart) ? Math.max(0, clip.start + clip.duration - nextStart) : 0
            const maxTrimEnd = clip.duration - initialTrimStart - MIN_CLIP_SECONDS
            if (minTrimEndByOverlap > maxTrimEnd) return
            const next = clamp(initialTrimEnd - dx, minTrimEndByOverlap, maxTrimEnd)
            updateVideoClip(clip.id, { trimEnd: next })
            onSeekPlayheadSeconds?.(Math.max(0, clip.start + clip.duration - next))
          }
        }
        const onUp = () => {
          window.removeEventListener("pointermove", onMove)
          window.removeEventListener("pointerup", onUp)
          isInteractingRef.current = false
        }
        window.addEventListener("pointermove", onMove)
        window.addEventListener("pointerup", onUp)
      }
    },
    [isInteractingRef, keyboardScopeRef, latestVideoClipsRef, onSeekPlayheadSeconds, onSelectSegment, pxPerSecond, setSingleSelected, updateVideoClip]
  )

  const makeDragHandler = useCallback(
    (clip: VideoClip) => {
      return (e: React.PointerEvent) => {
        if ((e.target as HTMLElement)?.dataset?.handle) return
        e.preventDefault()
        isInteractingRef.current = true
        const pointerTarget = e.currentTarget as HTMLElement
        const dragOutEnabled = Boolean((e.target as HTMLElement | null)?.closest?.("[data-dragout]"))
        const pointerId = e.pointerId
        try {
          pointerTarget.setPointerCapture(pointerId)
        } catch {}
        const selection = latestSelectedClipsRef.current
        const isInSelection = selection.some((s) => s.type === "video" && s.id === clip.id)
        const selectedVideoIds = isInSelection ? selection.filter((s) => s.type === "video").map((s) => s.id) : [clip.id]
        if (!isInSelection) setSingleSelected("video", clip.id)
        keyboardScopeRef.current?.focus()
        onSelectSegment(clip.segmentId)
        const startX = e.clientX
        const startY = e.clientY
        const startLaneRect =
          ((e.currentTarget as HTMLElement).parentElement as HTMLElement | null)?.getBoundingClientRect() ?? (e.currentTarget as HTMLElement).getBoundingClientRect()
        const initialStartById = new Map<string, number>()
        for (const c of latestVideoClipsRef.current) {
          initialStartById.set(c.id, c.start)
        }

        const selectedClipsSnapshot = () => {
          const selectedSet = new Set(selectedVideoIds)
          return latestVideoClipsRef.current.filter((c) => selectedSet.has(c.id))
        }

        let dragOutTriggered = false
        const outThresholdPx = 22

        const onMove = (ev: PointerEvent) => {
          const EPS = 1e-3
          const dxPx = ev.clientX - startX
          const dyPx = ev.clientY - startY
          const outByDistance = Math.abs(dyPx) >= outThresholdPx
          const outByLeave =
            ev.clientY < startLaneRect.top - 6 ||
            ev.clientY > startLaneRect.bottom + 6 ||
            ev.clientX < startLaneRect.left - 6 ||
            ev.clientX > startLaneRect.right + 6
          if (dragOutEnabled && !dragOutTriggered && (outByLeave || outByDistance)) {
            dragOutTriggered = true
            const selected = selectedClipsSnapshot()
            for (const c of selected) {
              const start0 = initialStartById.get(c.id)
              if (typeof start0 === "number") updateVideoClip(c.id, { start: start0 })
            }
            window.removeEventListener("pointermove", onMove)
            window.removeEventListener("pointerup", onUp)
            const clips: DraggedClip[] = selected.map((c) => ({
              type: "video",
              id: c.id,
              segmentId: c.segmentId,
              title: c.title,
              src: typeof c.src === "string" && c.src.trim() ? c.src.trim() : undefined,
              durationSeconds: c.duration - Math.max(0, c.trimStart) - Math.max(0, c.trimEnd),
              trimStart: c.trimStart,
              trimEnd: c.trimEnd
            }))
            try {
              pointerTarget.releasePointerCapture(pointerId)
            } catch {}
            beginDragOut(clips, { x: ev.clientX, y: ev.clientY }, pointerTarget, pointerId, ev.pointerType)
            return
          }
          const dx = (ev.clientX - startX) / pxPerSecond
          const selected = selectedClipsSnapshot()
          if (selected.length === 0) return
          const allClips = latestVideoClipsRef.current
          const selectedSet = new Set(selected.map((c) => c.id))
          const startOf = (c: VideoClip) => initialStartById.get(c.id) ?? c.start
          const toVisible = (c: VideoClip) => {
            const start0 = startOf(c)
            return { clip: c, start0, visibleStart: start0 + Math.max(0, c.trimStart), visibleEnd: start0 + c.duration - Math.max(0, c.trimEnd) }
          }
          const selectedVisible = selected.map(toVisible)
          const groupStart = Math.min(...selectedVisible.map((c) => c.visibleStart))
          const groupEnd = Math.max(...selectedVisible.map((c) => c.visibleEnd))

          const othersVisible = allClips.filter((c) => !selectedSet.has(c.id)).map(toVisible)
          const leftSide = othersVisible.filter((c) => c.visibleEnd <= groupStart + EPS)
          const rightSide = othersVisible.filter((c) => c.visibleStart >= groupEnd - EPS)

          let minDelta = Math.max(...selectedVisible.map((c) => -c.clip.trimStart - c.start0))
          if (rightSide.length > 0) {
            minDelta = Math.max(minDelta, Math.max(...rightSide.map((c) => -c.clip.trimStart - c.start0)))
          }
          if (leftSide.length > 0) {
            minDelta = Math.max(minDelta, Math.max(...leftSide.map((c) => c.visibleEnd)) - groupStart)
          }

          const baseDelta = Math.max(dx, minDelta)

          const snapThresholdSeconds = 8 / pxPerSecond
          const anchors: number[] = [0, ...markers]
          for (const other of leftSide) {
            anchors.push(other.visibleStart)
            anchors.push(other.visibleEnd)
          }

          const snappedDelta = (() => {
            const afterStart = groupStart + baseDelta
            const afterEnd = groupEnd + baseDelta
            let best: number | null = null
            let bestAbs = Number.POSITIVE_INFINITY
            for (const a of anchors) {
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

          const actualDelta = Math.max(snappedDelta ?? baseDelta, minDelta)
          for (const c of [...selectedVisible.map((c) => c.clip), ...rightSide.map((c) => c.clip)]) {
            const start0 = initialStartById.get(c.id)
            if (typeof start0 !== "number") continue
            updateVideoClip(c.id, { start: start0 + actualDelta })
          }
        }
        const onUp = () => {
          window.removeEventListener("pointermove", onMove)
          window.removeEventListener("pointerup", onUp)
          if (!dragOutTriggered) isInteractingRef.current = false
          try {
            pointerTarget.releasePointerCapture(pointerId)
          } catch {}
        }
        window.addEventListener("pointermove", onMove)
        window.addEventListener("pointerup", onUp)
      }
    },
    [beginDragOut, isInteractingRef, keyboardScopeRef, latestSelectedClipsRef, latestVideoClipsRef, markers, onSelectSegment, pxPerSecond, setSingleSelected, updateVideoClip]
  )

  const makeAudioDragHandler = useCallback(
    (clip: AudioClip) => {
      return (e: React.PointerEvent) => {
        e.preventDefault()
        isInteractingRef.current = true
        const pointerTarget = e.currentTarget as HTMLElement
        const dragOutEnabled = Boolean((e.target as HTMLElement | null)?.closest?.("[data-dragout]"))
        const pointerId = e.pointerId
        try {
          pointerTarget.setPointerCapture(pointerId)
        } catch {}
        const selection = latestSelectedClipsRef.current
        const isInSelection = selection.some((s) => s.type === "audio" && s.id === clip.id)
        const selectedAudioIds = isInSelection ? selection.filter((s) => s.type === "audio").map((s) => s.id) : [clip.id]
        if (!isInSelection) setSingleSelected("audio", clip.id)
        keyboardScopeRef.current?.focus()
        const startX = e.clientX
        const startY = e.clientY
        const startLaneRect =
          ((e.currentTarget as HTMLElement).parentElement as HTMLElement | null)?.getBoundingClientRect() ?? (e.currentTarget as HTMLElement).getBoundingClientRect()
        const initialStartById = new Map<string, number>()
        for (const id of selectedAudioIds) {
          const c = latestAudioClipsRef.current.find((a) => a.id === id)
          if (c) initialStartById.set(id, c.start)
        }
        let dragOutTriggered = false
        const outThresholdPx = 22
        const onMove = (ev: PointerEvent) => {
          const dxPx = ev.clientX - startX
          const dyPx = ev.clientY - startY
          const outByDistance = Math.abs(dyPx) >= outThresholdPx
          const outByLeave =
            ev.clientY < startLaneRect.top - 6 ||
            ev.clientY > startLaneRect.bottom + 6 ||
            ev.clientX < startLaneRect.left - 6 ||
            ev.clientX > startLaneRect.right + 6
          if (dragOutEnabled && !dragOutTriggered && (outByLeave || outByDistance)) {
            dragOutTriggered = true
            const selected = latestAudioClipsRef.current.filter((c) => selectedAudioIds.includes(c.id))
            for (const c of selected) {
              const start0 = initialStartById.get(c.id)
              if (typeof start0 === "number") updateAudioClip(c.id, { start: start0 })
            }
            window.removeEventListener("pointermove", onMove)
            window.removeEventListener("pointerup", onUp)
            const clips: DraggedClip[] = selected.map((c) => ({
              type: "audio",
              id: c.id,
              title: c.name,
              src: typeof c.src === "string" && c.src.trim() ? c.src.trim() : undefined,
              durationSeconds: c.duration
            }))
            try {
              pointerTarget.releasePointerCapture(pointerId)
            } catch {}
            beginDragOut(clips, { x: ev.clientX, y: ev.clientY }, pointerTarget, pointerId, ev.pointerType)
            return
          }
          const dx = (ev.clientX - startX) / pxPerSecond
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
        const onUp = () => {
          window.removeEventListener("pointermove", onMove)
          window.removeEventListener("pointerup", onUp)
          if (!dragOutTriggered) isInteractingRef.current = false
          try {
            pointerTarget.releasePointerCapture(pointerId)
          } catch {}
        }
        window.addEventListener("pointermove", onMove)
        window.addEventListener("pointerup", onUp)
      }
    },
    [beginDragOut, isInteractingRef, keyboardScopeRef, latestAudioClipsRef, latestSelectedClipsRef, pxPerSecond, setSingleSelected, updateAudioClip]
  )

  const onClipClick = useCallback(
    (e: React.MouseEvent, type: "video" | "audio", id: string, segmentId?: string) => {
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        toggleSelected(type, id)
      } else {
        setSingleSelected(type, id)
      }
      keyboardScopeRef.current?.focus()
      if (segmentId) onSelectSegment(segmentId)
    },
    [keyboardScopeRef, onSelectSegment, setSingleSelected, toggleSelected]
  )

  return { makeTrimHandler, makeDragHandler, makeAudioDragHandler, onClipClick }
}

