import { type ReactElement, useEffect, useRef, useState } from "react"
import styles from "./ImagePreviewModal.module.css"
import { PreviewPane } from "./ImagePreviewModalParts/PreviewPane"
import { SidePanel } from "./ImagePreviewModalParts/SidePanel"
import { useImageNaturalSize } from "./ImagePreviewModalParts/useImageNaturalSize"
import { useSelectionRect } from "./ImagePreviewModalParts/useSelectionRect"

type ImagePreviewModalProps = {
  open: boolean
  title: string
  imageSrc: string
  generatedImageId?: string
  storyboardId?: string | null
  category?: string | null
  frameKind?: "first" | "last" | null
  description?: string | null
  prompt?: string | null
  onStoryboardFrameUpdated?: (p: { storyboardId: string; frameKind: "first" | "last"; url: string; thumbnailUrl: string | null }) => void
  onClose: () => void
}

export function ImagePreviewModal({ open, title, imageSrc, generatedImageId, storyboardId, category, description, prompt, onClose }: ImagePreviewModalProps): ReactElement | null {
  const [currentSrc, setCurrentSrc] = useState(imageSrc)
  const [currentGeneratedImageId, setCurrentGeneratedImageId] = useState<string | undefined>(generatedImageId)
  const [editPrompt, setEditPrompt] = useState("")
  const frameRef = useRef<HTMLDivElement | null>(null)
  const imageSize = useImageNaturalSize(open, currentSrc)

  const selection = useSelectionRect({
    open,
    imageSize,
    frameRef,
    disabled: false
  })

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      if (selection.isEditing) {
        selection.setIsEditing(false)
        selection.setDraftRect(null)
        return
      }
      onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose, open, selection])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    selection.setIsEditing(false)
    selection.setDraftRect(null)
    selection.setConfirmedRect(null)
    setCurrentSrc(imageSrc?.trim() ? imageSrc : "")
    setCurrentGeneratedImageId(generatedImageId)
    setEditPrompt("")
  }, [open, imageSrc, generatedImageId])

  if (!open) return null

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <PreviewPane
          title={title}
          currentSrc={currentSrc}
          imageSize={imageSize}
          frameRef={frameRef}
          canEdit={selection.canEdit}
          isEditing={selection.isEditing}
          setIsEditing={selection.setIsEditing}
          confirmedRect={selection.confirmedRect}
          draftRect={selection.draftRect}
          setDraftRect={selection.setDraftRect}
          overlayStyle={selection.overlayStyle}
          overlayRect={selection.overlayRect}
          inpaintLoading={false}
          beginBoxSelect={selection.beginBoxSelect}
          onBoxSelectMove={selection.onBoxSelectMove}
          onBoxSelectEnd={selection.onBoxSelectEnd}
          startMove={selection.startMove}
          startResize={selection.startResize}
          onSelectionPointerMove={selection.onSelectionPointerMove}
          onSelectionPointerUp={selection.onSelectionPointerUp}
          clearSelection={selection.clearSelection}
        />

        <SidePanel
          open={open}
          title={title}
          description={description}
          prompt={prompt}
          storyboardId={storyboardId ?? null}
          category={category ?? null}
          currentSrc={currentSrc}
          setCurrentSrc={setCurrentSrc}
          currentGeneratedImageId={currentGeneratedImageId}
          setCurrentGeneratedImageId={setCurrentGeneratedImageId}
          isEditing={selection.isEditing}
          confirmedRect={selection.confirmedRect}
          setConfirmedRect={selection.setConfirmedRect}
          setIsEditing={selection.setIsEditing}
          editPrompt={editPrompt}
          setEditPrompt={setEditPrompt}
          onClose={onClose}
        />
      </div>
    </div>
  )
}
