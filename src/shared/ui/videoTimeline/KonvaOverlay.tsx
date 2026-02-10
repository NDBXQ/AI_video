"use client"

import { memo, type ReactElement } from "react"
import { Layer, Line, Stage } from "react-konva"
import { TRACK_OFFSET_PX } from "@/shared/utils/timelineUtils"

export const KonvaOverlay = memo(function KonvaOverlay(props: {
  widthPx: number
  heightPx: number
  pxPerSecond: number
  viewportStartPx: number
  viewportStartSeconds: number
  viewportEndSeconds: number
  markers?: number[]
  playheadSeconds?: number | null
  playheadActive?: boolean
}): ReactElement {
  const w = Math.max(0, Math.round(props.widthPx))
  const h = Math.max(0, Math.round(props.heightPx))
  const lines: ReactElement[] = []

  const markers = props.markers ?? []
  const minS = Math.max(0, props.viewportStartSeconds)
  const maxS = Math.max(minS, props.viewportEndSeconds)
  for (const s0 of markers) {
    const seconds = Number(s0)
    if (!Number.isFinite(seconds)) continue
    if (seconds < minS || seconds > maxS) continue
    const x = TRACK_OFFSET_PX + seconds * props.pxPerSecond - props.viewportStartPx
    lines.push(<Line key={`m-${seconds}`} points={[x, 0, x, h]} stroke="rgba(255, 255, 255, 0.26)" strokeWidth={2} listening={false} />)
  }

  if (props.playheadActive) {
    const s = Number(props.playheadSeconds ?? 0)
    if (Number.isFinite(s) && s >= 0) {
      const x = TRACK_OFFSET_PX + s * props.pxPerSecond - props.viewportStartPx
      lines.push(<Line key="p" points={[x, 0, x, h]} stroke="rgba(79, 70, 229, 0.95)" strokeWidth={2} listening={false} />)
    }
  }

  return (
    <Stage width={w} height={h} listening={false}>
      <Layer>{lines}</Layer>
    </Stage>
  )
})
