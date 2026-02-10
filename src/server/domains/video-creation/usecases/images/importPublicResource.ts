import { getDb } from "coze-coding-dev-sdk"
import { and, desc, eq } from "drizzle-orm"
import { generatedImages, publicResources, stories, storyOutlines, storyboards, type StoryboardScriptContent } from "@/shared/schema"
import { buildEmptyScript, renameEntityInScript, withReferenceAsset } from "@/server/domains/video-creation/lib/storyboardScript"

export async function importVideoCreationPublicResource(input: {
  userId: string
  storyboardId: string
  publicResourceId: string
  name: string
  displayName?: string
  category: string
}): Promise<
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; code: string; message: string; status: number }
> {
  const db = await getDb({ generatedImages, publicResources, stories, storyOutlines, storyboards })

  const storyRow = await db
    .select({ storyId: stories.id, scriptContent: storyboards.scriptContent })
    .from(storyboards)
    .innerJoin(storyOutlines, eq(storyboards.outlineId, storyOutlines.id))
    .innerJoin(stories, eq(storyOutlines.storyId, stories.id))
    .where(and(eq(storyboards.id, input.storyboardId), eq(stories.userId, input.userId)))
    .limit(1)

  const effectiveStoryId = storyRow[0]?.storyId ?? null
  if (!effectiveStoryId) return { ok: false, code: "STORY_NOT_FOUND", message: "未找到可用的故事", status: 404 }

  const pr = await db.select().from(publicResources).where(eq(publicResources.id, input.publicResourceId)).limit(1)
  const resource = pr[0] as any
  if (!resource) return { ok: false, code: "RESOURCE_NOT_FOUND", message: "未找到可用素材", status: 404 }

  const url = (resource.originalUrl || resource.previewUrl || "").trim()
  const storageKey = (resource.originalStorageKey || resource.previewStorageKey || "").trim()
  if (!url || !storageKey) return { ok: false, code: "RESOURCE_NOT_READY", message: "素材缺少可用存储信息", status: 400 }

  const thumbnailUrl = (resource.previewUrl || "").trim() || null
  const thumbnailStorageKey = (resource.previewStorageKey || "").trim() || null

  const assetName = typeof resource.name === "string" ? resource.name : input.displayName ?? input.name
  const assetDescription = typeof resource.description === "string" ? resource.description : ""

  const existed = await db
    .select({ id: generatedImages.id })
    .from(generatedImages)
    .where(
      and(
        eq(generatedImages.storyId, effectiveStoryId),
        eq(generatedImages.storyboardId, input.storyboardId),
        eq(generatedImages.name, input.name),
        eq(generatedImages.category, input.category)
      )
    )
    .orderBy(desc(generatedImages.createdAt))
    .limit(1)

  const existing = existed[0]
  const saved =
    existing
      ? (
          await db
            .update(generatedImages)
            .set({
              name: assetName,
              url,
              storageKey,
              thumbnailUrl,
              thumbnailStorageKey,
              description: typeof resource.description === "string" ? resource.description : null
            })
            .where(eq(generatedImages.id, existing.id))
            .returning()
        )[0]
      : (
          await db
            .insert(generatedImages)
            .values({
              storyId: effectiveStoryId,
              storyboardId: input.storyboardId,
              name: assetName,
              description: typeof resource.description === "string" ? resource.description : null,
              url,
              storageKey,
              thumbnailUrl,
              thumbnailStorageKey,
              category: input.category
            })
            .returning()
        )[0]

  const renamedScript = renameEntityInScript((storyRow[0]?.scriptContent ?? buildEmptyScript()) as StoryboardScriptContent, {
    category: input.category,
    from: input.name,
    to: assetName
  })
  const nextScript = withReferenceAsset(renamedScript, {
    category: input.category,
    entityName: assetName,
    assetName,
    assetDescription
  })
  await db.update(storyboards).set({ scriptContent: nextScript, updatedAt: new Date() }).where(eq(storyboards.id, input.storyboardId))

  return {
    ok: true,
    data: { ...(saved as any), pickedEntityName: assetName, pickedTitle: assetName, pickedDescription: assetDescription }
  }
}

