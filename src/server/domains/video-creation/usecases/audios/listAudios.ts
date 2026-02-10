import { getDb } from "coze-coding-dev-sdk"
import { and, desc, eq } from "drizzle-orm"
import { generatedAudios, stories, storyOutlines, storyboards } from "@/shared/schema"

export async function listVideoCreationAudios(input: {
  userId: string
  storyboardId: string
  limit: number
  offset: number
}): Promise<
  | {
      ok: true
      storyboardId: string
      items: Array<{
        id: string
        storyboardId: string
        storyId: string
        roleName: string
        speakerId: string
        speakerName: string
        content: string
        url: string
        storageKey: string | null
        audioSize: number | null
        createdAt: Date
      }>
      limit: number
      offset: number
    }
  | { ok: false; code: string; message: string; status: number }
> {
  const db = await getDb({ generatedAudios, stories, storyOutlines, storyboards })

  const allowed = await db
    .select({ storyboardId: storyboards.id, storyId: stories.id })
    .from(storyboards)
    .innerJoin(storyOutlines, eq(storyboards.outlineId, storyOutlines.id))
    .innerJoin(stories, eq(storyOutlines.storyId, stories.id))
    .where(and(eq(storyboards.id, input.storyboardId), eq(stories.userId, input.userId)))
    .limit(1)
  if (allowed.length === 0) return { ok: false, code: "STORYBOARD_NOT_FOUND", message: "未找到可用的分镜", status: 404 }

  const rows = await db
    .select({
      id: generatedAudios.id,
      storyId: generatedAudios.storyId,
      roleName: generatedAudios.roleName,
      speakerId: generatedAudios.speakerId,
      speakerName: generatedAudios.speakerName,
      content: generatedAudios.content,
      url: generatedAudios.url,
      storageKey: generatedAudios.storageKey,
      audioSize: generatedAudios.audioSize,
      createdAt: generatedAudios.createdAt
    })
    .from(generatedAudios)
    .where(and(eq(generatedAudios.storyboardId, input.storyboardId), eq(generatedAudios.storyId, allowed[0]!.storyId)))
    .orderBy(desc(generatedAudios.createdAt))
    .limit(input.limit)
    .offset(input.offset)

  const items = rows.map((r) => {
    return {
      ...r,
      storyboardId: input.storyboardId,
      storageKey: r.storageKey ?? null,
      audioSize: r.audioSize ?? null
    }
  })

  return { ok: true, storyboardId: input.storyboardId, items, limit: input.limit, offset: input.offset }
}
