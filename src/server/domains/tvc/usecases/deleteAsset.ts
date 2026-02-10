import { and, eq } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { tvcAssets, tvcLlmMessages, tvcStories } from "@/shared/schema/tvc"
import { ensureTvcSchema } from "@/server/db/ensureTvcSchema"
import { ServiceError } from "@/server/shared/errors"

type TvcAssetKind = "reference_image" | "first_frame" | "video_clip"

export async function deleteTvcProjectAsset(input: {
  userId: string
  storyId: string
  kind: TvcAssetKind
  ordinal: number
  traceId: string
}): Promise<
  | { ok: true }
  | {
      ok: false
      code: string
      message: string
      status: number
    }
> {
  const userId = String(input.userId ?? "").trim()
  const storyId = String(input.storyId ?? "").trim()
  const traceId = String(input.traceId ?? "").trim()
  const kind = String(input.kind ?? "").trim() as TvcAssetKind
  const ordinal = Number.isFinite(Number(input.ordinal)) ? Math.trunc(Number(input.ordinal)) : 0
  if (!userId || !storyId || !traceId) return { ok: false, code: "VALIDATION_FAILED", message: "参数缺失", status: 400 }
  if (!kind || !["reference_image", "first_frame", "video_clip"].includes(kind)) return { ok: false, code: "VALIDATION_FAILED", message: "kind 不合法", status: 400 }
  if (!ordinal || ordinal <= 0) return { ok: false, code: "VALIDATION_FAILED", message: "ordinal 不合法", status: 400 }

  await ensureTvcSchema()
  const db = await getDb({ tvcStories, tvcAssets, tvcLlmMessages })

  const [story] = await db.select({ id: tvcStories.id, userId: tvcStories.userId }).from(tvcStories).where(eq(tvcStories.id, storyId)).limit(1)
  if (!story || story.userId !== userId) return { ok: false, code: "NOT_FOUND", message: "项目不存在", status: 404 }

  const [asset] = await db
    .select({ id: tvcAssets.id })
    .from(tvcAssets)
    .where(and(eq(tvcAssets.storyId, storyId), eq(tvcAssets.kind, kind), eq(tvcAssets.assetOrdinal, ordinal)))
    .limit(1)
  if (!asset) return { ok: false, code: "NOT_FOUND", message: "素材不存在", status: 404 }

  const label = kind === "reference_image" ? "参考图" : kind === "first_frame" ? "分镜首帧" : "视频片段"
  const unit = kind === "video_clip" ? "段" : "张"
  const content = `我手动删除了第${ordinal}${unit}${label}`

  const inserted = await db
    .insert(tvcLlmMessages)
    .values({
      storyId,
      seq: 0,
      role: "user",
      content,
      name: null,
      toolCallId: null,
      toolCalls: null
    } as any)
    .returning({ id: tvcLlmMessages.id })
    .catch((err) => {
      throw new ServiceError("DB_INSERT_FAILED", String((err as any)?.message ?? "写入 llm_messages 失败"))
    })

  const msgId = inserted?.[0]?.id ? String(inserted[0].id) : ""
  if (!msgId) throw new ServiceError("DB_INSERT_FAILED", "写入 llm_messages 失败")

  try {
    await db.delete(tvcAssets).where(eq(tvcAssets.id, asset.id))
  } catch (err) {
    await db.delete(tvcLlmMessages).where(eq(tvcLlmMessages.id, msgId)).catch(() => null)
    throw new ServiceError("DB_DELETE_FAILED", String((err as any)?.message ?? "删除素材失败"))
  }

  return { ok: true }
}
