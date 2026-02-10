import { ServiceError } from "@/server/shared/errors"
import type { VibeSessionState } from "../../../vibeCreatingState"
import { getVibeSeedanceModel, VIBE_VIDEO_DURATION_MAX_SECONDS, VIBE_VIDEO_DURATION_MIN_SECONDS } from "../../../vibeCreatingConfig"
import { runWithConcurrencyLimit } from "../../../vibeCreatingConcurrency"
import { persistTvcVideoAsset } from "../../assets/persistAssets"
import { arkCreateVideoTask, arkWaitForVideoTask } from "../../../providers/ark/arkMedia"
import { ensureTvcSchema } from "@/server/db/ensureTvcSchema"
import { tvcAssets } from "@/shared/schema/tvc"
import { getDb } from "coze-coding-dev-sdk"
import { and, eq } from "drizzle-orm"
import { getS3Storage } from "@/shared/storage"
import { buildDirectBucketUrl, resolveStorageUrl } from "@/shared/storageUrl"

export async function generateVideosFromFirstFramesBatch(params: {
  traceId: string
  storyId: string
  state: VibeSessionState
  requests: Array<{ ordinal: number; firstFrameOrdinal: number; description: string; prompt: string; durationSeconds: number }>
  watermark: boolean
  maxConcurrent: number
  overwriteExisting?: boolean
}): Promise<{
  nextState: VibeSessionState
  results: Array<{ ordinal: number; status: "生成成功" | "生成失败"; kind: "video_clip"; url?: string }>
}> {
  const model = getVibeSeedanceModel()

  await ensureTvcSchema()
  const db = await getDb({ tvcAssets })
  const storage = (() => {
    try {
      return getS3Storage()
    } catch {
      return null
    }
  })()

  for (const r of params.requests) {
    const durationSeconds = Number(r.durationSeconds)
    if (
      !Number.isFinite(durationSeconds) ||
      !Number.isInteger(durationSeconds) ||
      durationSeconds < VIBE_VIDEO_DURATION_MIN_SECONDS ||
      durationSeconds > VIBE_VIDEO_DURATION_MAX_SECONDS
    ) {
      throw new ServiceError("TOOL_ARGS_INVALID", `requests[].duration_seconds 必须为 ${VIBE_VIDEO_DURATION_MIN_SECONDS}~${VIBE_VIDEO_DURATION_MAX_SECONDS} 的整数`)
    }
  }

  const resolveFirstFrameUrl = async (firstFrameOrdinal: number): Promise<string> => {
    const idx = Math.trunc(Number(firstFrameOrdinal))
    if (!Number.isFinite(idx) || idx <= 0) return ""
    const [row] = await db
      .select({ storageKey: tvcAssets.storageKey, meta: tvcAssets.meta })
      .from(tvcAssets)
      .where(and(eq(tvcAssets.storyId, params.storyId), eq(tvcAssets.kind, "first_frame"), eq(tvcAssets.assetOrdinal, idx)))
      .limit(1)
    if (!row?.storageKey) return ""
    let url = ""
    if (storage) {
      try {
        url = await resolveStorageUrl(storage, row.storageKey)
      } catch {
      }
    }
    if (!url) url = String((row.meta as any)?.url ?? "").trim()
    if (!url) {
      try {
        url = buildDirectBucketUrl(row.storageKey)
      } catch {
      }
    }
    return url
  }

  const tasks = params.requests.map((r) => async () => {
    try {
      const ordinal = Number.isFinite(Number(r.ordinal)) ? Math.trunc(Number(r.ordinal)) : 0
      if (ordinal <= 0) throw new ServiceError("TOOL_ARGS_INVALID", "ordinal 必须为正整数")

      if (!params.overwriteExisting) {
        const [existing] = await db
          .select({ storageKey: tvcAssets.storageKey, thumbnailStorageKey: tvcAssets.thumbnailStorageKey, meta: tvcAssets.meta })
          .from(tvcAssets)
          .where(and(eq(tvcAssets.storyId, params.storyId), eq(tvcAssets.kind, "video_clip"), eq(tvcAssets.assetOrdinal, ordinal)))
          .limit(1)
        if (existing?.storageKey) {
          let url = ""
          if (storage) {
            try {
              url = await resolveStorageUrl(storage, existing.storageKey)
            } catch {
            }
          }
          if (!url) url = String((existing.meta as any)?.url ?? "").trim()
          if (!url) {
            try {
              url = buildDirectBucketUrl(existing.storageKey)
            } catch {
            }
          }
          if (url) {
            return {
              ok: true as const,
              source: "existing" as const,
              ordinal,
              url,
              description: r.description,
              durationSeconds: r.durationSeconds,
              firstFrameOrdinal: r.firstFrameOrdinal
            }
          }
        }
      }

      const firstFrameUrl = await resolveFirstFrameUrl(r.firstFrameOrdinal)
      if (!firstFrameUrl) throw new ServiceError("FIRST_FRAME_NOT_FOUND", `首帧不存在：${r.firstFrameOrdinal}`)
      const created = await arkCreateVideoTask({
        model,
        prompt: r.prompt,
        firstFrameUrl,
        durationSeconds: r.durationSeconds,
        resolution: "720p",
        ratio: "16:9",
        watermark: params.watermark,
        returnLastFrame: true
      })
      const done = await arkWaitForVideoTask({ id: created.id })
      const url = done.videoUrl ?? ""
      if (!url) throw new ServiceError("VIDEO_GENERATION_FAILED", "视频生成失败：缺少 videoUrl")
      return {
        ok: true as const,
        source: "generated" as const,
        ordinal,
        url,
        description: r.description,
        durationSeconds: r.durationSeconds,
        firstFrameOrdinal: r.firstFrameOrdinal,
        lastFrameUrl: done.lastFrameUrl || undefined
      }
    } catch {
      return { ok: false as const, ordinal: Number.isFinite(Number(r.ordinal)) ? Math.trunc(Number(r.ordinal)) : 0 }
    }
  })

  const generated = await runWithConcurrencyLimit(tasks, params.maxConcurrent)
  const nextState = params.state
  const results: Array<{ ordinal: number; status: "生成成功" | "生成失败"; kind: "video_clip"; url?: string }> = []
  for (let i = 0; i < generated.length; i++) {
    const g = generated[i]!
    if (!g?.ok) {
      results.push({ ordinal: Number.isFinite(Number((g as any)?.ordinal)) ? Math.trunc(Number((g as any).ordinal)) : 0, status: "生成失败", kind: "video_clip" })
      continue
    }
    if (g.source === "existing") {
      results.push({ ordinal: g.ordinal, status: "生成成功", kind: "video_clip", url: g.url })
      continue
    }
    try {
      const persisted = await persistTvcVideoAsset({
        traceId: params.traceId,
        storyId: params.storyId,
        assetOrdinal: g.ordinal,
        sourceUrl: g.url,
        thumbnailSourceUrl: g.lastFrameUrl,
        meta: {
          description: g.description,
          durationSeconds: g.durationSeconds,
          firstFrameOrdinal: g.firstFrameOrdinal,
          requestedOrdinal: g.ordinal
        },
        overwriteExisting: Boolean(params.overwriteExisting)
      })
      results.push({ ordinal: g.ordinal, status: "生成成功", kind: "video_clip", url: persisted.url })
    } catch {
      results.push({ ordinal: g.ordinal, status: "生成失败", kind: "video_clip" })
    }
  }
  return { nextState, results }
}
