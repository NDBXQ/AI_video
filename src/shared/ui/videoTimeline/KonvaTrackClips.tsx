"use client"

import { memo, useEffect, useMemo, useState, type ReactElement } from "react"
import { Group, Layer, Rect, Stage, Text } from "react-konva"
import type { AudioClip, VideoClip } from "@/shared/utils/timelineUtils"

type SelectedKey = { type: "video" | "audio"; id: string }
type HoverEdge = { id: string; edge: "start" | "end" } | null

function buildSelectedSet(selected: SelectedKey[]) {
  const set = new Set<string>()
  for (const s of selected) set.add(`${s.type}:${s.id}`)
  return set
}

export const KonvaTrackClips = memo(function KonvaTrackClips(props: {
  widthPx: number
  heightPx: number
  pxPerSecond: number
  viewportStartPx: number
  viewportStartSeconds: number
  viewportEndSeconds: number
  kind: "video" | "audio"
  activeId?: string
  clips: VideoClip[] | AudioClip[]
  selectedClips: SelectedKey[]
  segmentFirstFrames?: Record<string, string>
  onStagePointerDown?: (e: any) => void
}): ReactElement {
  const w = Math.max(0, Math.round(props.widthPx))
  const h = Math.max(0, Math.round(props.heightPx))
  const selectedKeySet = buildSelectedSet(props.selectedClips)
  const y = 8
  const clipH = 32
  const nodeList: ReactElement[] = []
  const minS = Math.max(0, props.viewportStartSeconds)
  const maxS = Math.max(minS, props.viewportEndSeconds)
  const [hoverEdge, setHoverEdge] = useState<HoverEdge>(null)

  const visibleThumbUrls = useMemo(() => {
    if (props.kind !== "video") return []
    const urls: string[] = []
    const map = props.segmentFirstFrames ?? {}
    for (const c of props.clips as VideoClip[]) {
      const vs = c.start + Math.max(0, c.trimStart)
      const ve = c.start + c.duration - Math.max(0, c.trimEnd)
      if (ve < minS || vs > maxS) continue
      const url = typeof map[c.segmentId] === "string" ? String(map[c.segmentId]).trim() : ""
      if (url) urls.push(url)
    }
    return Array.from(new Set(urls))
  }, [maxS, minS, props.clips, props.kind, props.segmentFirstFrames])

  const [, bump] = useState(0)
  useEffect(() => {
    if (typeof window === "undefined") return
    for (const url of visibleThumbUrls) {
      if (!url) continue
      ensureImage(url, () => bump((v) => v + 1))
    }
  }, [visibleThumbUrls])

  const visibleVideoBounds = useMemo(() => {
    if (props.kind !== "video") return []
    const out: Array<{ id: string; left: number; width: number }> = []
    for (const c of props.clips as VideoClip[]) {
      const vs = c.start + Math.max(0, c.trimStart)
      const ve = c.start + c.duration - Math.max(0, c.trimEnd)
      if (ve < minS || vs > maxS) continue
      const left = Math.round((c.start + c.trimStart) * props.pxPerSecond - props.viewportStartPx)
      const width = Math.max(1, Math.round((c.duration - c.trimStart - c.trimEnd) * props.pxPerSecond))
      out.push({ id: c.id, left, width })
    }
    return out
  }, [maxS, minS, props.clips, props.kind, props.pxPerSecond, props.viewportStartPx])

  if (props.kind === "video") {
    const firstFrames = props.segmentFirstFrames ?? {}
    for (const c of props.clips as VideoClip[]) {
      const vs = c.start + Math.max(0, c.trimStart)
      const ve = c.start + c.duration - Math.max(0, c.trimEnd)
      if (ve < minS || vs > maxS) continue
      const left = Math.round((c.start + c.trimStart) * props.pxPerSecond - props.viewportStartPx)
      const width = Math.max(1, Math.round((c.duration - c.trimStart - c.trimEnd) * props.pxPerSecond))
      const active = c.segmentId === props.activeId
      const selected = selectedKeySet.has(`video:${c.id}`)
      const fill = active ? "rgba(109, 94, 247, 0.26)" : "rgba(109, 94, 247, 0.18)"
      const stroke = active ? "rgba(109, 94, 247, 0.55)" : "rgba(255, 255, 255, 0.10)"
      const thumbUrl = typeof firstFrames[c.segmentId] === "string" ? String(firstFrames[c.segmentId]).trim() : ""
      const normalized = thumbUrl ? normalizeImageUrl(thumbUrl) : ""
      const img = normalized ? imageCache.get(normalized) ?? null : null
      const ready = Boolean(img && img.complete && (img.naturalWidth || 0) > 0)
      const hover = hoverEdge?.id === c.id ? hoverEdge.edge : null
      nodeList.push(
        <Group key={c.id} x={left} y={y} listening={false}>
          {ready && img ? (
            <Rect
              width={width}
              height={clipH}
              cornerRadius={10}
              fillPatternImage={img}
              {...patternCover(img, width, clipH)}
            />
          ) : (
            <Rect width={width} height={clipH} cornerRadius={10} fill={fill} stroke={stroke} strokeWidth={1} />
          )}
          {ready ? (
            <Rect
              width={width}
              height={clipH}
              cornerRadius={10}
              fillLinearGradientStartPoint={{ x: 0, y: 0 }}
              fillLinearGradientEndPoint={{ x: 0, y: clipH }}
              fillLinearGradientColorStops={[0, "rgba(15, 23, 42, 0.14)", 1, "rgba(15, 23, 42, 0.28)"]}
              listening={false}
            />
          ) : null}
          {ready ? <Rect width={width} height={clipH} cornerRadius={10} stroke={stroke} strokeWidth={1} listening={false} /> : null}
          {selected ? <Rect width={width} height={clipH} cornerRadius={10} stroke="rgba(255, 255, 255, 0.16)" strokeWidth={2} /> : null}
          <Rect x={6} y={7} width={14} height={18} cornerRadius={6} fill="rgba(15, 23, 42, 0.26)" stroke="rgba(255, 255, 255, 0.10)" strokeWidth={1} />
          <Text
            x={10}
            y={8}
            width={Math.max(0, width - 14)}
            height={16}
            text={c.title}
            fontSize={12}
            fontStyle="bold"
            fill="rgba(255, 255, 255, 0.86)"
            ellipsis
          />
          <Rect x={-1} y={-2} width={10} height={36} cornerRadius={[10, 0, 0, 10]} fill="rgba(15, 23, 42, 0.16)" />
          <Rect x={Math.max(0, width - 9)} y={-2} width={10} height={36} cornerRadius={[0, 10, 10, 0]} fill="rgba(15, 23, 42, 0.16)" />
          {hover === "start" ? <Rect x={0} y={0} width={2} height={clipH} fill="rgba(255, 255, 255, 0.70)" listening={false} /> : null}
          {hover === "end" ? (
            <Rect x={Math.max(0, width - 2)} y={0} width={2} height={clipH} fill="rgba(255, 255, 255, 0.70)" listening={false} />
          ) : null}
        </Group>
      )
    }
  } else {
    for (const c of props.clips as AudioClip[]) {
      const vs = c.start
      const ve = c.start + c.duration
      if (ve < minS || vs > maxS) continue
      const left = Math.round(c.start * props.pxPerSecond - props.viewportStartPx)
      const width = Math.max(1, Math.round(c.duration * props.pxPerSecond))
      const selected = selectedKeySet.has(`audio:${c.id}`)
      nodeList.push(
        <Group key={c.id} x={left} y={y} listening={false}>
          <Rect width={width} height={clipH} cornerRadius={10} fill="rgba(16, 185, 129, 0.16)" stroke="rgba(16, 185, 129, 0.32)" strokeWidth={1} />
          {selected ? <Rect width={width} height={clipH} cornerRadius={10} stroke="rgba(255, 255, 255, 0.16)" strokeWidth={2} /> : null}
          <Rect x={6} y={7} width={14} height={18} cornerRadius={6} fill="rgba(15, 23, 42, 0.26)" stroke="rgba(255, 255, 255, 0.10)" strokeWidth={1} />
          <Text
            x={10}
            y={8}
            width={Math.max(0, width - 14)}
            height={16}
            text={c.name}
            fontSize={12}
            fontStyle="bold"
            fill="rgba(255, 255, 255, 0.86)"
            ellipsis
          />
        </Group>
      )
    }
  }

  return (
    <Stage
      width={w}
      height={h}
      onPointerDown={(e) => {
        e.cancelBubble = true
        props.onStagePointerDown?.(e)
      }}
      onPointerMove={(e) => {
        if (props.kind !== "video") return
        const stage = e.target.getStage()
        const pos = stage?.getPointerPosition()
        if (!pos) return
        const thresholdPx = 8
        let next: HoverEdge = null
        for (const b of visibleVideoBounds) {
          if (pos.x < b.left || pos.x > b.left + b.width) continue
          if (Math.abs(pos.x - b.left) <= thresholdPx) next = { id: b.id, edge: "start" }
          else if (Math.abs(b.left + b.width - pos.x) <= thresholdPx) next = { id: b.id, edge: "end" }
          break
        }
        setHoverEdge((prev) => (prev?.id === next?.id && prev?.edge === next?.edge ? prev : next))
        if (stage) stage.container().style.cursor = next ? "ew-resize" : "default"
      }}
      onPointerLeave={(e) => {
        const stage = e.target.getStage()
        if (stage) stage.container().style.cursor = "default"
        setHoverEdge(null)
      }}
    >
      <Layer>{nodeList}</Layer>
    </Stage>
  )
})

const imageCache = new Map<string, HTMLImageElement>()
const loadingUrls = new Set<string>()

function normalizeImageUrl(input: string) {
  const url = String(input ?? "").trim()
  if (!url) return ""
  if (url.startsWith("data:") || url.startsWith("blob:") || url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/")) return url
  return `/${url}`
}

function ensureImage(inputUrl: string, onReady: () => void) {
  const url = normalizeImageUrl(inputUrl)
  if (!url) return
  if (imageCache.has(url)) return
  if (loadingUrls.has(url)) return
  loadingUrls.add(url)
  const img = new Image()
  img.decoding = "async"
  img.loading = "eager"
  img.onload = () => {
    loadingUrls.delete(url)
    imageCache.set(url, img)
    onReady()
  }
  img.onerror = () => {
    loadingUrls.delete(url)
  }
  img.src = url
}

function patternCover(img: HTMLImageElement, targetW: number, targetH: number) {
  const iw = img.naturalWidth || img.width || 1
  const ih = img.naturalHeight || img.height || 1
  const scale = Math.max(targetW / iw, targetH / ih)
  const scaledW = iw * scale
  const scaledH = ih * scale
  const offsetX = (scaledW - targetW) / 2 / scale
  const offsetY = (scaledH - targetH) / 2 / scale
  return {
    fillPatternScaleX: scale,
    fillPatternScaleY: scale,
    fillPatternOffsetX: offsetX,
    fillPatternOffsetY: offsetY
  } as const
}
