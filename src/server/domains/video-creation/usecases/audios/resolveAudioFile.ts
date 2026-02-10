import { getDb } from "coze-coding-dev-sdk"
import { and, eq } from "drizzle-orm"
import { generatedAudios, stories, storyOutlines, storyboards } from "@/shared/schema"
import { getS3Storage } from "@/shared/storage"
import { resolveStorageUrl } from "@/shared/storageUrl"

export async function resolveVideoCreationAudioFileUrl(input: {
  userId: string
  audioId: string
}): Promise<
  | { ok: true; url: string }
  | { ok: false; code: string; message: string; status: number }
> {
  const db = await getDb({ generatedAudios, stories, storyOutlines, storyboards })
  const rows = await db
    .select({
      storageKey: generatedAudios.storageKey,
      url: generatedAudios.url
    })
    .from(generatedAudios)
    .innerJoin(storyboards, eq(generatedAudios.storyboardId, storyboards.id))
    .innerJoin(storyOutlines, eq(storyboards.outlineId, storyOutlines.id))
    .innerJoin(stories, eq(storyOutlines.storyId, stories.id))
    .where(and(eq(generatedAudios.id, input.audioId), eq(stories.userId, input.userId)))
    .limit(1)

  const row = rows[0]
  if (!row) return { ok: false, code: "NOT_FOUND", message: "音频不存在", status: 404 }

  const storageKey = row.storageKey
  const fallbackUrl = row.url
  if (!storageKey) {
    if (!fallbackUrl) return { ok: false, code: "NOT_FOUND", message: "音频链接不存在", status: 404 }
    return { ok: true, url: fallbackUrl }
  }

  const storage = getS3Storage()
  try {
    const url = await resolveStorageUrl(storage, storageKey)
    return { ok: true, url }
  } catch {
    if (!fallbackUrl) return { ok: false, code: "NOT_FOUND", message: "音频链接不存在", status: 404 }
    return { ok: true, url: fallbackUrl }
  }
}

