import { type ReactElement, useEffect, useRef, useState } from "react"
import styles from "./ImagePreviewModal.module.css"
import { PreviewPane } from "./ImagePreviewModalParts/PreviewPane"
import { SidePanel } from "./ImagePreviewModalParts/SidePanel"
import { useImageNaturalSize } from "./ImagePreviewModalParts/useImageNaturalSize"
import { useSelectionRect } from "./ImagePreviewModalParts/useSelectionRect"
import { ImageAssetPickerModal } from "./ImagePreview/ImageAssetPickerModal"

type ImagePreviewModalProps = {
  open: boolean
  title: string
  imageSrc: string
  generatedImageId?: string
  storyId?: string | null
  storyboardId?: string | null
  category?: string | null
  frameKind?: "first" | "last" | null
  tvcAsset?: { kind: "reference_image" | "first_frame"; ordinal: number } | null
  description?: string | null
  prompt?: string | null
  onStoryboardFrameUpdated?: (p: { storyboardId: string; frameKind: "first" | "last"; url: string; thumbnailUrl: string | null }) => void
  onClose: () => void
}

export function ImagePreviewModal({
  open,
  title,
  imageSrc,
  generatedImageId,
  storyId,
  storyboardId,
  category,
  frameKind,
  tvcAsset,
  description,
  prompt,
  onStoryboardFrameUpdated,
  onClose
}: ImagePreviewModalProps): ReactElement | null {
  if (!open) return null
  const modalKey = [title, imageSrc, generatedImageId, storyboardId, frameKind, tvcAsset?.kind, tvcAsset?.ordinal]
    .filter(Boolean)
    .join("|")
  return (
    <ImagePreviewModalInner
      key={modalKey}
      title={title}
      imageSrc={imageSrc}
      generatedImageId={generatedImageId}
      storyId={storyId}
      storyboardId={storyboardId}
      category={category}
      frameKind={frameKind}
      tvcAsset={tvcAsset}
      description={description}
      prompt={prompt}
      onStoryboardFrameUpdated={onStoryboardFrameUpdated}
      onClose={onClose}
    />
  )
}

function ImagePreviewModalInner({
  title,
  imageSrc,
  generatedImageId,
  storyId,
  storyboardId,
  category,
  frameKind,
  tvcAsset,
  description,
  prompt,
  onStoryboardFrameUpdated,
  onClose
}: Omit<ImagePreviewModalProps, "open">): ReactElement {
  const open = true
  const [currentSrc, setCurrentSrc] = useState(() => (imageSrc?.trim() ? imageSrc : ""))
  const [currentGeneratedImageId, setCurrentGeneratedImageId] = useState<string | undefined>(() => generatedImageId)
  const [currentEntityName, setCurrentEntityName] = useState<string>(() => title)
  const [currentMetaTitle, setCurrentMetaTitle] = useState<string>(() => title)
  const [currentMetaDescription, setCurrentMetaDescription] = useState<string | null>(() => description ?? null)
  const [editPrompt, setEditPrompt] = useState("")
  const [replacePickerOpen, setReplacePickerOpen] = useState(false)
  const frameRef = useRef<HTMLDivElement | null>(null)
  const imageSize = useImageNaturalSize(open, currentSrc)

  const selection = useSelectionRect({
    open,
    imageSize,
    frameRef,
    disabled: false
  })

  useEffect(() => {
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
  }, [onClose, selection])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  const stableStoryboardId = typeof storyboardId === "string" ? storyboardId.trim() : ""

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={currentEntityName}>
        <PreviewPane
          title={currentEntityName}
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
          title={currentEntityName}
          metaTitle={currentMetaTitle}
          description={description}
          metaDescription={currentMetaDescription}
          prompt={prompt}
          storyId={storyId ?? null}
          storyboardId={storyboardId ?? null}
          category={category ?? null}
          frameKind={frameKind ?? null}
          tvcAsset={tvcAsset ?? null}
          currentSrc={currentSrc}
          setCurrentSrc={setCurrentSrc}
          currentGeneratedImageId={currentGeneratedImageId}
          setCurrentGeneratedImageId={setCurrentGeneratedImageId}
          setCurrentEntityName={setCurrentEntityName}
          setCurrentMetaTitle={setCurrentMetaTitle}
          setCurrentMetaDescription={setCurrentMetaDescription}
          isEditing={selection.isEditing}
          confirmedRect={selection.confirmedRect}
          setConfirmedRect={selection.setConfirmedRect}
          setIsEditing={selection.setIsEditing}
          editPrompt={editPrompt}
          setEditPrompt={setEditPrompt}
          onReplaceFromLibrary={() => setReplacePickerOpen(true)}
          onStoryboardFrameUpdated={onStoryboardFrameUpdated}
          onClose={onClose}
        />

        <ImageAssetPickerModal
          open={replacePickerOpen && Boolean(stableStoryboardId)}
          title={currentEntityName}
          entityName={currentEntityName}
          storyId={storyId ?? null}
          storyboardId={stableStoryboardId}
          category={(category ?? "background") as any}
          onPicked={({ url, thumbnailUrl, generatedImageId, entityName, metaTitle, metaDescription }) => {
            setReplacePickerOpen(false)
            setCurrentSrc(url)
            setCurrentGeneratedImageId(generatedImageId)
            if (typeof entityName === "string") setCurrentEntityName(entityName.trim() ? entityName : title)
            if (typeof metaTitle === "string") setCurrentMetaTitle(metaTitle.trim() ? metaTitle : title)
            if (typeof metaDescription === "string") setCurrentMetaDescription(metaDescription.trim() ? metaDescription : null)
            selection.setIsEditing(false)
            selection.setDraftRect(null)
            selection.setConfirmedRect(null)
            setEditPrompt("")
            if (stableStoryboardId)
              window.dispatchEvent(new CustomEvent("video_reference_images_updated", { detail: { storyboardId: stableStoryboardId, refreshStoryboards: true } }))
            if (stableStoryboardId && frameKind && onStoryboardFrameUpdated) onStoryboardFrameUpdated({ storyboardId: stableStoryboardId, frameKind, url, thumbnailUrl })
          }}
          onClose={() => setReplacePickerOpen(false)}
        />
      </div>
    </div>
  )
}
