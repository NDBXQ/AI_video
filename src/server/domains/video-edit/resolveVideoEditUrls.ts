import { getDb } from "coze-coding-dev-sdk"
import { and, eq, inArray } from "drizzle-orm"
import { generatedAudios } from "@/shared/schema/generation"
import { publicResources } from "@/shared/schema/library"
import { stories } from "@/shared/schema/story"
import { getS3Storage } from "@/shared/storage"
import { resolveStorageUrl } from "@/shared/storageUrl"

export const STABLE_PUBLIC_RESOURCE_PREFIX = "/api/library/public-resources/file/"
export const STABLE_GENERATED_AUDIO_PREFIX = "/api/video-creation/audios/file/"

function extractStableResourceId(input: string, origin: string): { id: string; kind: "preview" | "original" } | null {
  const raw = input.trim()
  if (raw.startsWith(STABLE_PUBLIC_RESOURCE_PREFIX)) {
    const u = new URL(raw, origin)
    const id = u.pathname.slice(STABLE_PUBLIC_RESOURCE_PREFIX.length).split("/")[0] || ""
    const kind = u.searchParams.get("kind") === "preview" ? "preview" : "original"
    return id ? { id, kind } : null
  }
  if (raw.startsWith("http")) {
    try {
      const u = new URL(raw)
      if (u.origin !== origin) return null
      if (!u.pathname.startsWith(STABLE_PUBLIC_RESOURCE_PREFIX)) return null
      const id = u.pathname.slice(STABLE_PUBLIC_RESOURCE_PREFIX.length).split("/")[0] || ""
      const kind = u.searchParams.get("kind") === "preview" ? "preview" : "original"
      return id ? { id, kind } : null
    } catch {
      return null
    }
  }
  return null
}

function extractGeneratedAudioId(input: string, origin: string): string | null {
  const raw = input.trim()
  if (raw.startsWith(STABLE_GENERATED_AUDIO_PREFIX)) {
    const u = new URL(raw, origin)
    const id = u.pathname.slice(STABLE_GENERATED_AUDIO_PREFIX.length).split("/")[0] || ""
    return id || null
  }
  if (raw.startsWith("http")) {
    try {
      const u = new URL(raw)
      if (u.origin !== origin) return null
      if (!u.pathname.startsWith(STABLE_GENERATED_AUDIO_PREFIX)) return null
      const id = u.pathname.slice(STABLE_GENERATED_AUDIO_PREFIX.length).split("/")[0] || ""
      return id || null
    } catch {
      return null
    }
  }
  return null
}

export async function resolveVideoEditUrls(input: {
  userId: string
  origin: string
  video_config_list: Array<{ url: string; start_time: number; end_time: number }>
  audio_config_list: Array<{ url: string; start_time: number; end_time: number; timeline_start: number }>
}): Promise<{
  video_config_list: Array<{ url: string; start_time: number; end_time: number }>
  audio_config_list: Array<{ url: string; start_time: number; end_time: number; timeline_start: number }>
}> {
  const db = await getDb({ publicResources, generatedAudios, stories })

  const publicTargets = [...input.video_config_list, ...input.audio_config_list]
    .map((it) => extractStableResourceId(it.url, input.origin))
    .filter(Boolean) as Array<{ id: string; kind: "preview" | "original" }>

  const uniquePublicIds = Array.from(new Set(publicTargets.map((t) => t.id)))
  const resourceRows =
    uniquePublicIds.length > 0
      ? await db
          .select({
            id: publicResources.id,
            previewUrl: publicResources.previewUrl,
            originalUrl: publicResources.originalUrl,
            previewStorageKey: publicResources.previewStorageKey,
            originalStorageKey: publicResources.originalStorageKey
          })
          .from(publicResources)
          .where(inArray(publicResources.id, uniquePublicIds as any))
      : []

  const resourceMap = new Map<string, (typeof resourceRows)[number]>()
  for (const r of resourceRows) resourceMap.set(String(r.id), r)

  const audioIds = Array.from(
    new Set(
      [...input.video_config_list, ...input.audio_config_list]
        .map((it) => extractGeneratedAudioId(it.url, input.origin))
        .filter(Boolean) as string[]
    )
  )

  const audioRows =
    audioIds.length > 0
      ? await db
          .select({
            id: generatedAudios.id,
            storageKey: generatedAudios.storageKey,
            url: generatedAudios.url
          })
          .from(generatedAudios)
          .innerJoin(stories, eq(generatedAudios.storyId, stories.id))
          .where(and(inArray(generatedAudios.id, audioIds as any), eq(stories.userId, input.userId)))
      : []

  const audioMap = new Map<string, (typeof audioRows)[number]>()
  for (const r of audioRows) audioMap.set(String(r.id), r)

  const storage = getS3Storage()
  const resolveUrl = async (raw: string): Promise<string> => {
    const extracted = extractStableResourceId(raw, input.origin)
    if (extracted) {
      const row = resourceMap.get(extracted.id) ?? null
      if (!row) throw new Error(`资源不存在: ${extracted.id}`)
      const storageKey = extracted.kind === "preview" ? row.previewStorageKey : row.originalStorageKey
      const fallbackUrl = extracted.kind === "preview" ? row.previewUrl : row.originalUrl || row.previewUrl
      if (storageKey) {
        return await resolveStorageUrl(storage, storageKey)
      }
      if (typeof fallbackUrl === "string" && fallbackUrl.startsWith("http")) return fallbackUrl
      throw new Error(`资源链接不存在: ${extracted.id}`)
    }

    const audioId = extractGeneratedAudioId(raw, input.origin)
    if (audioId) {
      const row = audioMap.get(audioId) ?? null
      if (!row) throw new Error(`音频不存在: ${audioId}`)
      if (row.storageKey) {
        return await resolveStorageUrl(storage, row.storageKey)
      }
      if (typeof row.url === "string" && row.url.startsWith("http")) return row.url
      throw new Error(`音频链接不存在: ${audioId}`)
    }

    return raw
  }

  const resolvedVideoList = await Promise.all(input.video_config_list.map(async (v) => ({ ...v, url: await resolveUrl(v.url) })))
  const resolvedAudioList = await Promise.all(input.audio_config_list.map(async (v) => ({ ...v, url: await resolveUrl(v.url) })))

  return { video_config_list: resolvedVideoList, audio_config_list: resolvedAudioList }
}
