import { getDb } from "coze-coding-dev-sdk"
import { and, eq } from "drizzle-orm"
import { generatedImages, stories, storyboards, type StoryboardScriptContent } from "@/shared/schema"
import { buildEmptyScript, normalizeEntityCategory, renameEntityInScript, withReferenceAsset } from "@/server/domains/video-creation/lib/storyboardScript"

export async function deleteVideoCreationImage(input: { userId: string; imageId: string }): Promise<{ ok: true } | { ok: false; code: string; message: string; status: number }> {
  const db = await getDb({ generatedImages, stories })
  const allowed = await db
    .select({ id: generatedImages.id })
    .from(generatedImages)
    .innerJoin(stories, eq(generatedImages.storyId, stories.id))
    .where(and(eq(generatedImages.id, input.imageId), eq(stories.userId, input.userId)))
    .limit(1)

  if (allowed.length === 0) {
    return { ok: false, code: "NOT_FOUND", message: "素材不存在或无权限删除", status: 404 }
  }

  await db.delete(generatedImages).where(eq(generatedImages.id, input.imageId))
  return { ok: true }
}

export async function patchVideoCreationImage(input: {
  userId: string
  imageId: string
  patch: { name?: string; description?: string | null; prompt?: string | null }
}): Promise<
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; code: string; message: string; status: number }
> {
  const db = await getDb({ generatedImages, stories, storyboards })

  const rows = await db
    .select({
      id: generatedImages.id,
      storyId: generatedImages.storyId,
      storyboardId: generatedImages.storyboardId,
      name: generatedImages.name,
      category: generatedImages.category,
      description: generatedImages.description,
      prompt: generatedImages.prompt
    })
    .from(generatedImages)
    .innerJoin(stories, eq(generatedImages.storyId, stories.id))
    .where(and(eq(generatedImages.id, input.imageId), eq(stories.userId, input.userId)))
    .limit(1)

  const existing = rows[0]
  if (!existing) return { ok: false, code: "NOT_FOUND", message: "素材不存在或无权限编辑", status: 404 }

  const nextName = typeof input.patch.name === "string" ? input.patch.name.trim() : existing.name
  const nextDescription = input.patch.description === undefined ? existing.description : input.patch.description
  const nextPrompt = input.patch.prompt === undefined ? existing.prompt : input.patch.prompt

  const saved =
    (
      await db
        .update(generatedImages)
        .set({ name: nextName, description: nextDescription ?? null, prompt: nextPrompt ?? null })
        .where(eq(generatedImages.id, existing.id))
        .returning()
    )[0] ?? null

  const sbId = typeof existing.storyboardId === "string" ? existing.storyboardId.trim() : ""
  const category = normalizeEntityCategory(existing.category)
  if (sbId && (existing.name !== nextName || input.patch.description !== undefined)) {
    const sbRow = await db.select({ scriptContent: storyboards.scriptContent }).from(storyboards).where(eq(storyboards.id, sbId)).limit(1)
    const currentScript = (sbRow[0]?.scriptContent as StoryboardScriptContent | null) ?? buildEmptyScript()
    const renamed = existing.name !== nextName ? renameEntityInScript(currentScript, { category, from: existing.name, to: nextName }) : currentScript
    const nextScript = withReferenceAsset(renamed, {
      category,
      entityName: nextName,
      assetName: nextName,
      assetDescription: typeof nextDescription === "string" ? nextDescription : ""
    })
    await db.update(storyboards).set({ scriptContent: nextScript, updatedAt: new Date() }).where(eq(storyboards.id, sbId))
  }

  return { ok: true, data: { ...(saved as any) } }
}
