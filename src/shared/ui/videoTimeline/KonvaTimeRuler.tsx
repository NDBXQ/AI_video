"use client"

import { memo, useRef, type ReactElement } from "react"
import { Group, Layer, Line, Rect, Stage, Text } from "react-konva"
import { TRACK_OFFSET_PX, clamp } from "@/shared/utils/timelineUtils"

export const KonvaTimeRuler = memo(function KonvaTimeRuler(props: {
  totalSeconds: number
  pxPerSecond: number
  widthPx: number
  viewportStartPx: number
  viewportStartSeconds: number
  viewportEndSeconds: number
  markers?: number[]
  onRemoveMarker?: (seconds: number) => void
  playheadActive?: boolean
  onSeekPlayheadSeconds?: (seconds: number) => void
  onSeekStart?: () => void
  onSeekEnd?: () => void
}): ReactElement {
  const w = Math.max(0, Math.round(props.widthPx))
  const h = 26
  const ticks: ReactElement[] = []
  const startS = Math.max(0, Math.floor(props.viewportStartSeconds))
  const endS = Math.min(Math.floor(props.totalSeconds), Math.ceil(props.viewportEndSeconds))
  for (let s = startS; s <= endS; s += 1) {
    const x = TRACK_OFFSET_PX + s * props.pxPerSecond - props.viewportStartPx
    ticks.push(<Line key={`l-${s}`} points={[x, 0, x, h]} stroke="rgba(255, 255, 255, 0.12)" strokeWidth={1} listening={false} />)
    if (s % 2 === 0) {
      ticks.push(
        <Text
          key={`t-${s}`}
          x={x + 4}
          y={5}
          text={`${s}s`}
          fontSize={10}
          fontStyle="bold"
          fill="rgba(255, 255, 255, 0.55)"
          listening={false}
        />
      )
    }
  }

  const minS = Math.max(0, props.viewportStartSeconds)
  const maxS = Math.max(minS, props.viewportEndSeconds)
  const markerNodes: ReactElement[] = []
  for (const s0 of props.markers ?? []) {
    const seconds = Number(s0)
    if (!Number.isFinite(seconds)) continue
    if (seconds < minS || seconds > maxS) continue
    const x = TRACK_OFFSET_PX + seconds * props.pxPerSecond - props.viewportStartPx
    const label = `${seconds.toFixed(2)}s`
    const labelW = Math.max(38, Math.min(84, 18 + label.length * 6))
    markerNodes.push(
      <Group
        key={`mk-${seconds}`}
        x={Math.round(x) + 6}
        y={3}
        onPointerDown={(e) => {
          e.cancelBubble = true
          props.onRemoveMarker?.(seconds)
        }}
      >
        <Rect
          width={labelW}
          height={18}
          cornerRadius={999}
          fill="rgba(15, 23, 42, 0.82)"
          stroke="rgba(255, 255, 255, 0.12)"
          strokeWidth={1}
        />
        <Text x={8} y={3} text={label} fontSize={11} fontStyle="bold" fill="rgba(255, 255, 255, 0.86)" listening={false} />
      </Group>
    )
  }

  const seekingRef = useRef(false)
  const seekByPosX = (posX: number) => {
    if (!props.playheadActive) return
    if (!props.onSeekPlayheadSeconds) return
    const seconds = clamp((posX + props.viewportStartPx - TRACK_OFFSET_PX) / props.pxPerSecond, 0, props.totalSeconds)
    props.onSeekPlayheadSeconds(seconds)
  }

  return (
    <Stage
      width={w}
      height={h}
      onPointerDown={(e) => {
        if (!props.playheadActive || !props.onSeekPlayheadSeconds) return
        const stage = e.target.getStage()
        const pos = stage?.getPointerPosition()
        if (!pos) return
        seekingRef.current = true
        props.onSeekStart?.()
        seekByPosX(pos.x)
        const onMove = (ev: PointerEvent) => {
          if (!seekingRef.current) return
          const rect = stage?.container().getBoundingClientRect()
          if (!rect) return
          seekByPosX(ev.clientX - rect.left)
        }
        const onUp = () => {
          seekingRef.current = false
          window.removeEventListener("pointermove", onMove)
          window.removeEventListener("pointerup", onUp)
          props.onSeekEnd?.()
        }
        window.addEventListener("pointermove", onMove)
        window.addEventListener("pointerup", onUp)
      }}
    >
      <Layer listening={false}>{ticks}</Layer>
      <Layer>{markerNodes}</Layer>
    </Stage>
  )
})
