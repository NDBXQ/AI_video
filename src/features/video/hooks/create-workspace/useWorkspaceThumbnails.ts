import { useMemo } from "react"
import type { StoryboardItem } from "@/features/video/types"
import type { Thumbnail } from "@/shared/utils/mediaPreviewUtils"
import { createLocalPreviewSvg } from "@/shared/utils/previewUtils"

export function useWorkspaceThumbnails(params: {
  items: StoryboardItem[]
  activeStoryboardId: string
  sceneNo: number
  activeTab: "image" | "video"
  previewImageSrcById: Record<string, string>
  previewVideoSrcById: Record<string, string>
}): Thumbnail[] {
  const { items, activeStoryboardId, sceneNo, activeTab, previewImageSrcById, previewVideoSrcById } = params

  return useMemo(() => {
    if (items.length === 0) {
      return [
        {
          id: activeStoryboardId || `scene-${sceneNo}`,
          title: `镜 ${sceneNo}`,
          imageSrc: createLocalPreviewSvg(`镜 ${sceneNo}`),
          firstFrameSrc: createLocalPreviewSvg(`镜 ${sceneNo}`)
        }
      ]
    }

    return items.map((it) => {
      const localPreview = (previewImageSrcById[it.id] ?? "").trim()
      const isUrlLike = (v: string) => v.startsWith("http") || v.startsWith("data:")
      const firstFromDb = ((it.frames?.first?.thumbnailUrl ?? "").trim() || (it.frames?.first?.url ?? "").trim()) || createLocalPreviewSvg(`镜 ${it.scene_no}`)

      const firstFrameSrc = isUrlLike(localPreview) ? localPreview : firstFromDb

      const imageSrc =
        activeTab === "video"
          ? (previewVideoSrcById[it.id] ?? it.videoInfo?.url ?? createLocalPreviewSvg(`镜 ${it.scene_no} / 未生成`))
          : (() => {
              if (isUrlLike(localPreview)) return localPreview

              const dbUrl = (it.frames?.first?.url ?? "").trim()
              const dbThumb = (it.frames?.first?.thumbnailUrl ?? "").trim()
              const isComposed = (u: string) => u.includes("composed_")
              if (dbUrl && isComposed(dbUrl)) return dbUrl
              if (dbThumb && isComposed(dbThumb)) return dbThumb
              return createLocalPreviewSvg(`镜 ${it.scene_no}`)
            })()

      return { id: it.id, title: `镜 ${it.scene_no}`, firstFrameSrc, imageSrc }
    })
  }, [activeStoryboardId, activeTab, items, previewImageSrcById, previewVideoSrcById, sceneNo])
}
