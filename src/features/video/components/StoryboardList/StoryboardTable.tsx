import { type ReactElement, useCallback, useState } from "react"
import type { StoryboardItem } from "../../types"
import type { ScriptGenerateState } from "../../hooks/useScriptGeneration"
import styles from "./StoryboardTable.module.css"
import { StoryboardTableRow } from "./StoryboardTableRow"
import { ImageAssetPickerModal } from "../ImagePreview/ImageAssetPickerModal"
import type { OpenStoryboardTextEditParams } from "./textEditTypes"

type PreviewRow = { id: string; name: string; url: string; thumbnailUrl?: string | null; category?: string; storyboardId?: string | null; isGlobal?: boolean; description?: string | null; prompt?: string | null }

type StoryboardTableProps = {
  items: StoryboardItem[]
  storyId?: string
  outlineId?: string
  updateItemById: (id: string, updater: (item: StoryboardItem) => StoryboardItem) => void
  selectedItems: Set<string>
  scriptGenerateById: Record<string, ScriptGenerateState>
  previewsById: Record<string, { role: PreviewRow[]; background: PreviewRow[]; item: PreviewRow[] }>
  isLoading: boolean
  onSelectAll: () => void
  onSelect: (id: string) => void
  onPreviewImage: (
    title: string,
    imageSrc: string,
    generatedImageId?: string,
    storyboardId?: string | null,
    category?: string | null,
    description?: string | null,
    prompt?: string | null
  ) => void
  onGenerateReferenceImages?: (storyboardId: string) => void
  refImageGeneratingById?: Record<string, boolean>
  onOpenEdit: (params: OpenStoryboardTextEditParams) => void
  onOpenDetails: (itemId: string) => void
  onDelete: (id: string) => void
}

function normalizeName(name: string): string {
  return (name ?? "").trim()
}

export function StoryboardTable({
  items,
  storyId,
  outlineId,
  updateItemById,
  selectedItems,
  scriptGenerateById,
  previewsById,
  isLoading,
  onSelectAll,
  onSelect,
  onPreviewImage,
  onGenerateReferenceImages,
  refImageGeneratingById,
  onOpenEdit,
  onOpenDetails,
  onDelete
}: StoryboardTableProps): ReactElement {
  const showSkeleton = isLoading && items.length === 0

  const [assetPickerOpen, setAssetPickerOpen] = useState(false)
  const [assetPickerStoryboardId, setAssetPickerStoryboardId] = useState<string | null>(null)
  const [assetPickerCategory, setAssetPickerCategory] = useState<"role" | "background" | "item">("background")
  const [assetPickerTitle, setAssetPickerTitle] = useState("")
  const [assetPickerEntityName, setAssetPickerEntityName] = useState<string>("")

  const openAssetPicker = useCallback((params: { storyboardId: string; category: "role" | "background" | "item"; title: string; entityName?: string }) => {
    setAssetPickerStoryboardId(params.storyboardId)
    setAssetPickerCategory(params.category)
    setAssetPickerTitle(params.title)
    setAssetPickerEntityName(normalizeName(params.entityName ?? params.title))
    setAssetPickerOpen(true)
  }, [])

  const closeAssetPicker = useCallback(() => {
    setAssetPickerOpen(false)
  }, [])

  const persistScriptContent = useCallback(async (storyboardId: string, nextScriptContent: unknown) => {
    const res = await fetch("/api/video/storyboards", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storyboardId, scriptContent: nextScriptContent })
    })
    const json = (await res.json().catch(() => null)) as { ok: boolean; error?: { message?: string } } | null
    if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`)
  }, [])

  const computeNextScriptAdd = useCallback((it: StoryboardItem, category: "role" | "item", nameRaw: string) => {
    const name = normalizeName(nameRaw)
    const current = (it.scriptContent as any) ?? {}
    const shotContent = (current.shot_content as any) ?? {}
    const videoContent = (current.video_content as any) ?? {}
    const nextShotContent = { ...shotContent }
    const nextVideoContent = { ...videoContent }

    if (category === "role") {
      const roles = (Array.isArray(nextShotContent.roles) ? nextShotContent.roles.slice() : []) as any[]
      if (!roles.some((r: any) => typeof r?.role_name === "string" && r.role_name.trim() === name)) {
        roles.push({
          role_name: name,
          appearance_time_point: "",
          location_info: "",
          action: "",
          expression: "",
          speak: ""
        })
      }
      nextShotContent.roles = roles

      const vcRoles = (Array.isArray(nextVideoContent.roles) ? nextVideoContent.roles.slice() : []) as any[]
      if (!vcRoles.some((r: any) => typeof r?.role_name === "string" && r.role_name.trim() === name)) {
        vcRoles.push({ role_name: name, description: "" })
      }
      nextVideoContent.roles = vcRoles
    } else {
      const otherItems = (Array.isArray(nextShotContent.other_items) ? nextShotContent.other_items.slice() : []) as any[]
      if (!otherItems.some((v: any) => typeof v === "string" && v.trim() === name)) otherItems.push(name)
      nextShotContent.other_items = otherItems

      const vcItems = (Array.isArray(nextVideoContent.items) ? nextVideoContent.items.slice() : []) as any[]
      if (!vcItems.some((r: any) => typeof r?.item_name === "string" && r.item_name.trim() === name)) {
        vcItems.push({ item_name: name, description: "" })
      }
      nextVideoContent.items = vcItems
    }

    return { ...current, shot_content: nextShotContent, video_content: nextVideoContent }
  }, [])

  const computeNextScriptRemove = useCallback((it: StoryboardItem, category: "role" | "item", nameRaw: string) => {
    const name = normalizeName(nameRaw)
    const current = (it.scriptContent as any) ?? {}
    const shotContent = (current.shot_content as any) ?? {}
    const videoContent = (current.video_content as any) ?? {}
    const nextShotContent = { ...shotContent }
    const nextVideoContent = { ...videoContent }

    if (category === "role") {
      const roles = (Array.isArray(nextShotContent.roles) ? nextShotContent.roles.slice() : []) as any[]
      nextShotContent.roles = roles.filter((r: any) => !(typeof r?.role_name === "string" && r.role_name.trim() === name))

      const vcRoles = (Array.isArray(nextVideoContent.roles) ? nextVideoContent.roles.slice() : []) as any[]
      nextVideoContent.roles = vcRoles.filter((r: any) => !(typeof r?.role_name === "string" && r.role_name.trim() === name))
    } else {
      const roleItems = (Array.isArray(nextShotContent.role_items) ? nextShotContent.role_items.slice() : []) as any[]
      const otherItems = (Array.isArray(nextShotContent.other_items) ? nextShotContent.other_items.slice() : []) as any[]
      nextShotContent.role_items = roleItems.filter((v: any) => !(typeof v === "string" && v.trim() === name))
      nextShotContent.other_items = otherItems.filter((v: any) => !(typeof v === "string" && v.trim() === name))

      const vcItems = (Array.isArray(nextVideoContent.items) ? nextVideoContent.items.slice() : []) as any[]
      const vcOther = (Array.isArray(nextVideoContent.other_items) ? nextVideoContent.other_items.slice() : []) as any[]
      nextVideoContent.items = vcItems.filter((r: any) => !(typeof r?.item_name === "string" && r.item_name.trim() === name))
      nextVideoContent.other_items = vcOther.filter((r: any) => !(typeof r?.item_name === "string" && r.item_name.trim() === name))
    }

    return { ...current, shot_content: nextShotContent, video_content: nextVideoContent }
  }, [])

  const applyScriptPatch = useCallback(async (storyboardId: string, category: "role" | "item", name: string, kind: "add" | "remove") => {
    const it = items.find((x) => x.id === storyboardId)
    if (!it) return
    const next = kind === "add" ? computeNextScriptAdd(it, category, name) : computeNextScriptRemove(it, category, name)
    await persistScriptContent(storyboardId, next)
    updateItemById(storyboardId, (prev) => {
      const shotContent = (next as any)?.shot_content ?? prev.shot_content
      return { ...prev, scriptContent: next as any, shot_content: shotContent }
    })
  }, [computeNextScriptAdd, computeNextScriptRemove, items, persistScriptContent, updateItemById])

  const onDeleteAsset = useCallback(async (p: { storyboardId: string; category: "role" | "item"; name: string; imageId?: string | null; isGlobal?: boolean }) => {
    const name = normalizeName(p.name)
    if (!name) return
    await applyScriptPatch(p.storyboardId, p.category, name, "remove")
    if (!p.isGlobal && p.imageId) {
      const res = await fetch(`/api/video-creation/images/${encodeURIComponent(p.imageId)}`, { method: "DELETE" })
      const json = (await res.json().catch(() => null)) as { ok: boolean; error?: { message?: string } } | null
      if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`)
    }
    window.dispatchEvent(new CustomEvent("video_reference_images_updated", { detail: { storyboardId: p.storyboardId } }))
  }, [applyScriptPatch])

  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.colCheckbox}>
              <input type="checkbox" checked={items.length > 0 && selectedItems.size === items.length} onChange={onSelectAll} />
            </th>
            <th className={styles.colNo}>镜号</th>
            <th className={styles.colVisual}>分镜描述</th>
            <th className={styles.colRole}>角色</th>
            <th className={styles.colBackground}>背景</th>
            <th className={styles.colItems}>物品</th>
            <th className={styles.colFrames}>首尾帧图片</th>
            <th className={styles.colActions}>操作</th>
          </tr>
        </thead>
        <tbody>
          {showSkeleton
            ? Array.from({ length: 6 }).map((_, idx) => (
                <tr key={`skeleton-${idx}`}>
                  <td className={styles.colCheckbox}><div className={styles.skeletonBox} /></td>
                  <td className={styles.colNo}><div className={styles.skeletonBox} /></td>
                  <td className={styles.colVisual}><div className={styles.skeletonBox} style={{ height: 44 }} /></td>
                  <td className={styles.colRole}><div className={styles.skeletonBox} /></td>
                  <td className={styles.colBackground}><div className={styles.skeletonBox} /></td>
                  <td className={styles.colItems}><div className={styles.skeletonBox} /></td>
                  <td className={styles.colFrames}><div className={styles.skeletonBox} /></td>
                  <td className={styles.colActions}><div className={styles.skeletonBox} /></td>
                </tr>
              ))
            : items.map((item) => (
                <StoryboardTableRow
                  key={item.id}
                  item={item}
                  isSelected={selectedItems.has(item.id)}
                  generationState={scriptGenerateById[item.id]}
                  storyId={storyId}
                  outlineId={outlineId}
                  onSelect={onSelect}
                  previews={previewsById[item.id]}
                  onPreviewImage={onPreviewImage}
                  onPickAsset={openAssetPicker}
                  onDeleteAsset={onDeleteAsset}
                  onGenerateReferenceImages={onGenerateReferenceImages}
                  refImageGenerating={Boolean(refImageGeneratingById?.[item.id])}
                  onOpenEdit={onOpenEdit}
                  onOpenDetails={onOpenDetails}
                  onDelete={onDelete}
                />
              ))}
        </tbody>
      </table>

      {assetPickerStoryboardId ? (
        <ImageAssetPickerModal
          open={assetPickerOpen}
          title={assetPickerTitle}
          entityName={assetPickerEntityName}
          storyId={storyId ?? null}
          storyboardId={assetPickerStoryboardId}
          category={assetPickerCategory}
          onPicked={({ url, generatedImageId }) => {
            window.dispatchEvent(new CustomEvent("video_reference_images_updated", { detail: { storyboardId: assetPickerStoryboardId } }))
            onPreviewImage(assetPickerTitle, url, generatedImageId, assetPickerStoryboardId, assetPickerCategory, null, null)
            if (assetPickerCategory !== "background") {
              void applyScriptPatch(assetPickerStoryboardId, assetPickerCategory === "role" ? "role" : "item", assetPickerEntityName, "add")
            }
          }}
          onClose={closeAssetPicker}
        />
      ) : null}
    </div>
  )
}
