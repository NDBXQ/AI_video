import { useCallback } from "react"
import { clamp, type AudioClip, type VideoClip } from "@/shared/utils/timelineUtils"

export function useTimelineKeyboardDelete(params: {
  selectedClips: Array<{ type: "video" | "audio"; id: string }>
  setSelectedClips: React.Dispatch<React.SetStateAction<Array<{ type: "video" | "audio"; id: string }>>>
  setVideoClips: React.Dispatch<React.SetStateAction<VideoClip[]>>
  setAudioClips: React.Dispatch<React.SetStateAction<AudioClip[]>>
  markers: number[]
  setMarkers: React.Dispatch<React.SetStateAction<number[]>>
  playheadActive?: boolean
  playheadSeconds?: number | null
  onSeekPlayheadSeconds?: (seconds: number) => void
  totalSeconds: number
  onZoom: (deltaY: number) => void
}): { onKeyDown: (e: React.KeyboardEvent) => void } {
  const { selectedClips, setSelectedClips, setVideoClips, setAudioClips, markers, setMarkers, playheadActive, playheadSeconds, onSeekPlayheadSeconds, totalSeconds, onZoom } = params

  const deleteSelectedClips = useCallback(() => {
    if (!selectedClips.length) return
    const vIds = new Set<string>()
    const aIds = new Set<string>()
    for (const s of selectedClips) {
      if (s.type === "video") vIds.add(s.id)
      if (s.type === "audio") aIds.add(s.id)
    }
    if (vIds.size) setVideoClips((prev) => prev.filter((c) => !vIds.has(c.id)))
    if (aIds.size) setAudioClips((prev) => prev.filter((c) => !aIds.has(c.id)))
    setSelectedClips([])
  }, [selectedClips, setAudioClips, setSelectedClips, setVideoClips])

  const rippleDeleteSelectedClips = useCallback(() => {
    if (!selectedClips.length) return
    const selectedVideoIds = new Set(selectedClips.filter((s) => s.type === "video").map((s) => s.id))
    const selectedAudioIds = new Set(selectedClips.filter((s) => s.type === "audio").map((s) => s.id))
    const EPS = 1e-3

    if (selectedVideoIds.size) {
      setVideoClips((prev) => {
        const visibleStart = (c: VideoClip) => c.start + Math.max(0, c.trimStart)
        const visibleEnd = (c: VideoClip) => c.start + c.duration - Math.max(0, c.trimEnd)

        const removed = prev
          .filter((c) => selectedVideoIds.has(c.id))
          .map((c) => ({ start: visibleStart(c), end: visibleEnd(c), len: Math.max(0, visibleEnd(c) - visibleStart(c)) }))
          .filter((r) => r.len > EPS)
          .sort((a, b) => a.start - b.start)

        let remaining = prev.filter((c) => !selectedVideoIds.has(c.id))
        for (const r of removed) {
          remaining = remaining.map((c) => {
            const s = visibleStart(c)
            if (s >= r.start - EPS) return { ...c, start: c.start - r.len }
            return c
          })
        }
        return remaining
      })
    }

    if (selectedAudioIds.size) {
      setAudioClips((prev) => {
        const removed = prev
          .filter((c) => selectedAudioIds.has(c.id))
          .map((c) => ({ start: c.start, len: Math.max(0, c.duration) }))
          .filter((r) => r.len > EPS)
          .sort((a, b) => a.start - b.start)

        let remaining = prev.filter((c) => !selectedAudioIds.has(c.id))
        for (const r of removed) {
          remaining = remaining.map((c) => (c.start >= r.start - EPS ? { ...c, start: Math.max(0, c.start - r.len) } : c))
        }
        return remaining
      })
    }

    setSelectedClips([])
  }, [selectedClips, setAudioClips, setSelectedClips, setVideoClips])

  const nudgeSelected = useCallback(
    (delta: number) => {
      const selectedVideoIds = new Set(selectedClips.filter((s) => s.type === "video").map((s) => s.id))
      const selectedAudioIds = new Set(selectedClips.filter((s) => s.type === "audio").map((s) => s.id))

      if (selectedAudioIds.size) {
        setAudioClips((prev) => {
          const selected = prev.filter((c) => selectedAudioIds.has(c.id))
          if (!selected.length) return prev
          const minDelta = Math.max(...selected.map((c) => -c.start))
          const actual = Math.max(delta, minDelta)
          return prev.map((c) => (selectedAudioIds.has(c.id) ? { ...c, start: Math.max(0, c.start + actual) } : c))
        })
      }

      if (selectedVideoIds.size) {
        setVideoClips((prev) => {
          const selected = prev.filter((c) => selectedVideoIds.has(c.id))
          if (!selected.length) return prev
          const EPS = 1e-3
          const visibleStart = (c: VideoClip) => c.start + Math.max(0, c.trimStart)
          const visibleEnd = (c: VideoClip) => c.start + c.duration - Math.max(0, c.trimEnd)
          const groupStart = Math.min(...selected.map(visibleStart))
          const groupEnd = Math.max(...selected.map(visibleEnd))

          let minDelta = Math.max(...selected.map((c) => -c.trimStart - c.start))
          let maxDelta = Number.POSITIVE_INFINITY

          for (const other of prev) {
            if (selectedVideoIds.has(other.id)) continue
            const s = visibleStart(other)
            const e2 = visibleEnd(other)
            if (e2 <= groupStart + EPS) minDelta = Math.max(minDelta, e2 - groupStart)
            if (s >= groupEnd - EPS) maxDelta = Math.min(maxDelta, s - groupEnd)
          }

          const actual = clamp(delta, minDelta, maxDelta)
          if (!Number.isFinite(actual) || Math.abs(actual) < EPS) return prev
          return prev.map((c) => (selectedVideoIds.has(c.id) ? { ...c, start: c.start + actual } : c))
        })
      }
    },
    [selectedClips, setAudioClips, setVideoClips]
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = (target?.tagName ?? "").toLowerCase()
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return

      if ((e.ctrlKey || e.metaKey) && (e.key === "+" || e.key === "=")) {
        e.preventDefault()
        onZoom(-1)
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "-") {
        e.preventDefault()
        onZoom(1)
        return
      }

      if (e.key === "m" || e.key === "M") {
        if (!playheadActive) return
        const s = Number(playheadSeconds ?? 0)
        if (!Number.isFinite(s) || s < 0) return
        e.preventDefault()
        const v = Math.round(s * 1000) / 1000
        setMarkers((prev) => {
          const exists = prev.some((x) => Math.abs(x - v) <= 1e-3)
          if (exists) return prev
          return [...prev, v].sort((a, b) => a - b).slice(0, 80)
        })
        return
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (!selectedClips.length) return
        e.preventDefault()
        if (e.shiftKey) rippleDeleteSelectedClips()
        else deleteSelectedClips()
        return
      }

      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault()
        const baseStep = e.altKey ? 0.02 : e.shiftKey ? 1 : 0.1
        const delta = e.key === "ArrowLeft" ? -baseStep : baseStep
        if (selectedClips.length) {
          nudgeSelected(delta)
          return
        }
        if (!playheadActive) return
        if (!onSeekPlayheadSeconds) return
        const next = clamp(Number(playheadSeconds ?? 0) + delta, 0, totalSeconds)
        onSeekPlayheadSeconds(next)
      }
    },
    [deleteSelectedClips, nudgeSelected, onSeekPlayheadSeconds, onZoom, playheadActive, playheadSeconds, rippleDeleteSelectedClips, selectedClips, setMarkers, totalSeconds]
  )

  return { onKeyDown }
}
