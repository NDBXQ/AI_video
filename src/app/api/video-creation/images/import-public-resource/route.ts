import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { and, desc, eq } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { getSessionFromRequest } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { generatedImages, publicResources, stories, storyOutlines, storyboards, type StoryboardScriptContent } from "@/shared/schema"

const bodySchema = z.object({
  storyboardId: z.string().trim().min(1).max(200),
  publicResourceId: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(200),
  displayName: z.string().trim().min(1).max(200).optional(),
  category: z.string().trim().min(1).max(50).default("reference"),
})

function buildEmptyScript(): StoryboardScriptContent {
  return {
    shot_info: { cut_to: false, shot_style: "", shot_duration: 0 },
    shot_content: {
      bgm: "",
      roles: [],
      shoot: { angle: "", shot_angle: "", camera_movement: "" },
      background: { status: "", background_name: "" },
      role_items: [],
      other_items: []
    },
    video_content: {
      items: [],
      roles: [],
      background: { description: "", background_name: "" },
      other_items: []
    }
  }
}

function withReferenceAsset(
  current: StoryboardScriptContent | null,
  input: { category: string; entityName: string; assetName: string; assetDescription: string }
): StoryboardScriptContent {
  const next = current ? structuredClone(current) : buildEmptyScript()
  const entityName = input.entityName.trim()
  const assetName = input.assetName.trim()
  const assetDescription = input.assetDescription.trim()
  if (!entityName || !assetName) return next

  if (input.category === "role") {
    const roles = Array.isArray(next.video_content.roles) ? next.video_content.roles : []
    let row = roles.find((r) => (r.role_name ?? "").trim() === entityName)
    if (!row) {
      row = { role_name: entityName, description: "" }
      roles.push(row)
      next.video_content.roles = roles
    }
    row.reference_image_name = assetName
    row.reference_image_description = assetDescription
    return next
  }

  if (input.category === "background") {
    const bg = next.video_content.background ?? { description: "", background_name: "" }
    bg.reference_image_name = assetName
    bg.reference_image_description = assetDescription
    next.video_content.background = bg
    return next
  }

  const items = Array.isArray(next.video_content.items) ? next.video_content.items : []
  const otherItems = Array.isArray(next.video_content.other_items) ? next.video_content.other_items : []
  let row =
    items.find((r) => (r.item_name ?? "").trim() === entityName) ??
    otherItems.find((r) => (r.item_name ?? "").trim() === entityName) ??
    null
  if (!row) {
    row = { relation: "", item_name: entityName, description: "" }
    items.push(row)
    next.video_content.items = items
  }
  row.reference_image_name = assetName
  row.reference_image_description = assetDescription
  return next
}

export async function POST(req: NextRequest): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const session = await getSessionFromRequest(req)
  const userId = session?.userId
  if (!userId) return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(makeApiErr(traceId, "INVALID_JSON", "请求体不是合法 JSON"), { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })

  const { storyboardId, publicResourceId, name, displayName, category } = parsed.data

  const db = await getDb({ generatedImages, publicResources, stories, storyOutlines, storyboards })

  const storyRow = await db
    .select({ storyId: stories.id, scriptContent: storyboards.scriptContent })
    .from(storyboards)
    .innerJoin(storyOutlines, eq(storyboards.outlineId, storyOutlines.id))
    .innerJoin(stories, eq(storyOutlines.storyId, stories.id))
    .where(and(eq(storyboards.id, storyboardId), eq(stories.userId, userId)))
    .limit(1)

  const effectiveStoryId = storyRow[0]?.storyId ?? null
  if (!effectiveStoryId) return NextResponse.json(makeApiErr(traceId, "STORY_NOT_FOUND", "未找到可用的故事"), { status: 404 })

  const pr = await db.select().from(publicResources).where(eq(publicResources.id, publicResourceId)).limit(1)
  const resource = pr[0] as any
  if (!resource) return NextResponse.json(makeApiErr(traceId, "RESOURCE_NOT_FOUND", "未找到可用素材"), { status: 404 })

  const url = (resource.originalUrl || resource.previewUrl || "").trim()
  const storageKey = (resource.originalStorageKey || resource.previewStorageKey || "").trim()
  if (!url || !storageKey) return NextResponse.json(makeApiErr(traceId, "RESOURCE_NOT_READY", "素材缺少可用存储信息"), { status: 400 })

  const thumbnailUrl = (resource.previewUrl || "").trim() || null
  const thumbnailStorageKey = (resource.previewStorageKey || "").trim() || null

  const existed = await db
    .select({ id: generatedImages.id })
    .from(generatedImages)
    .where(and(eq(generatedImages.storyId, effectiveStoryId), eq(generatedImages.storyboardId, storyboardId), eq(generatedImages.name, name), eq(generatedImages.category, category)))
    .orderBy(desc(generatedImages.createdAt))
    .limit(1)

  const existing = existed[0]
  const saved =
    existing
      ? (
          await db
            .update(generatedImages)
            .set({
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
              storyboardId,
              name,
              description: typeof resource.description === "string" ? resource.description : null,
              url,
              storageKey,
              thumbnailUrl,
              thumbnailStorageKey,
              category
            })
            .returning()
        )[0]

  const assetName = typeof resource.name === "string" ? resource.name : displayName ?? name
  const assetDescription = typeof resource.description === "string" ? resource.description : ""
  const nextScript = withReferenceAsset(storyRow[0]?.scriptContent ?? null, {
    category,
    entityName: name,
    assetName,
    assetDescription
  })
  await db.update(storyboards).set({ scriptContent: nextScript, updatedAt: new Date() }).where(eq(storyboards.id, storyboardId))

  return NextResponse.json(makeApiOk(traceId, saved), { status: 200 })
}
