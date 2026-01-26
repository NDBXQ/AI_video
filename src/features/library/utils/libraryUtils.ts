import type { Scope } from "../components/ScopeTabs"
import type { CategoryOption } from "../components/CategorySidebar"
import type { ViewMode } from "../components/LibraryToolbar"
import type { LibraryItem } from "../components/LibraryCard"
import type { PublicResource } from "@/shared/schema"

export const MY_CATEGORIES: CategoryOption[] = [
  { id: "draft", label: "草稿" },
  { id: "video", label: "成片" },
  { id: "storyboard", label: "分镜脚本" },
  { id: "material", label: "素材" },
]

export const PUBLIC_CATEGORIES: CategoryOption[] = [
  { id: "all", label: "全部" },
  { id: "roles", label: "角色库" },
  { id: "backgrounds", label: "场景库" },
  { id: "props", label: "物品库" },
  { id: "audios", label: "音频库" },
  { id: "videos", label: "视频库" },
]

export function normalizeScope(raw: string | null): Scope {
  return raw === "public" ? "public" : "my"
}

export function normalizeCategory(scope: Scope, raw: string | null): string {
  if (scope === "public") return raw ?? "all"
  return raw ?? "draft"
}

export function normalizeView(raw: string | null): ViewMode {
  return raw === "list" ? "list" : "grid"
}

export function mapCategoryToPublicType(category: string): "all" | "character" | "background" | "props" | "audio" | "video" {
  if (category === "roles") return "character"
  if (category === "backgrounds") return "background"
  if (category === "props") return "props"
  if (category === "audios") return "audio"
  if (category === "videos") return "video"
  return "all"
}

export function mapPublicTypeToCategory(type: string): string {
  if (type === "character") return "roles"
  if (type === "background") return "backgrounds"
  if (type === "props") return "props"
  if (type === "audio" || type === "music" || type === "effect") return "audios"
  if (type === "video" || type === "transition") return "videos"
  return "all"
}

export function mapPublicResourceToItem(resource: PublicResource): LibraryItem {
  return {
    id: resource.id,
    title: resource.name,
    type: "material",
    scope: "public",
    publicCategory: mapPublicTypeToCategory(resource.type),
    subtitle: resource.description,
    thumbnail: resource.previewUrl || resource.originalUrl || undefined,
    originalUrl: resource.originalUrl || resource.previewUrl || undefined
  }
}

export type AiResourceType = "background" | "character" | "scene"

export function mapAiTypeToDbType(t: AiResourceType): "background" | "character" | "props" {
  if (t === "scene") return "background"
  return t
}
