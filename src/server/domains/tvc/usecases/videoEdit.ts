import { getDb } from "coze-coding-dev-sdk"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { tvcStories } from "@/shared/schema/tvc"
import { ensureTvcSchema } from "@/server/db/ensureTvcSchema"
import { readEnv, readEnvInt } from "@/features/coze/env"
import { callCozeRunEndpoint } from "@/features/coze/runEndpointClient"
import { logger } from "@/shared/logger"
import { resolveVideoEditUrls } from "@/server/domains/video-edit/resolveVideoEditUrls"

const outputSchema = z
  .object({
    output_video_url: z.string().trim().url().max(5_000).optional(),
    final_video_url: z.string().trim().url().max(5_000).optional(),
    video_meta: z.unknown().optional()
  })
  .refine((v) => Boolean(v.output_video_url || v.final_video_url), { message: "缺少 output_video_url / final_video_url" })

export async function editTvcProjectVideo(input: {
  traceId: string
  userId: string
  storyId: string
  origin: string
  video_config_list: Array<{ url: string; start_time: number; end_time: number }>
  audio_config_list: Array<{ url: string; start_time: number; end_time: number; timeline_start: number }>
}): Promise<
  | { ok: true; finalVideoUrl: string }
  | { ok: false; code: string; message: string; status: number }
> {
  await ensureTvcSchema()

  const token = readEnv("VIDEO_EDIT_API_TOKEN")
  const url = readEnv("VIDEO_EDIT_API_URL") ?? "https://h4y9qnk5qt.coze.site/run"
  if (!token) return { ok: false, code: "COZE_NOT_CONFIGURED", message: "未配置 VIDEO_EDIT_API_TOKEN", status: 500 }
  const timeoutMs = readEnvInt("REQUEST_TIMEOUT_MS") ?? 120_000

  const db = await getDb({ tvcStories })
  const allowed = await db.select({ id: tvcStories.id, userId: tvcStories.userId }).from(tvcStories).where(eq(tvcStories.id, input.storyId)).limit(1)
  if (!allowed[0] || allowed[0].userId !== input.userId) return { ok: false, code: "NOT_FOUND", message: "项目不存在", status: 404 }

  const startedAt = performance.now()
  logger.info({
    event: "tvc_video_edit_start",
    module: "tvc",
    traceId: input.traceId,
    message: "开始请求 TVC 视频剪辑合成",
    userId: input.userId,
    videoClips: input.video_config_list.length,
    audioClips: input.audio_config_list.length
  })

  try {
    const resolved = await resolveVideoEditUrls({
      userId: input.userId,
      origin: input.origin,
      video_config_list: input.video_config_list,
      audio_config_list: input.audio_config_list
    })

    const coze = await callCozeRunEndpoint({
      traceId: input.traceId,
      url,
      token,
      timeoutMs,
      module: "video-edit",
      body: {
        video_config_list: resolved.video_config_list,
        audio_config_list: resolved.audio_config_list
      }
    })

    const normalized = outputSchema.safeParse(coze.data)
    if (!normalized.success) {
      logger.warn({
        event: "tvc_video_edit_invalid_response",
        module: "tvc",
        traceId: input.traceId,
        message: "剪辑接口返回格式不符合预期",
        durationMs: Math.round(performance.now() - startedAt)
      })
      return { ok: false, code: "VIDEO_EDIT_INVALID_RESPONSE", message: "剪辑接口返回格式不符合预期", status: 502 }
    }

    const resultUrl = (normalized.data.output_video_url ?? normalized.data.final_video_url ?? "").trim()
    await db
      .update(tvcStories)
      .set({ finalVideoUrl: resultUrl, updatedAt: new Date(), progressStage: "done" })
      .where(and(eq(tvcStories.id, input.storyId), eq(tvcStories.userId, input.userId)))

    logger.info({
      event: "tvc_video_edit_success",
      module: "tvc",
      traceId: input.traceId,
      message: "TVC 视频剪辑合成成功",
      durationMs: Math.round(performance.now() - startedAt)
    })

    return { ok: true, finalVideoUrl: resultUrl }
  } catch {
    logger.error({
      event: "tvc_video_edit_error",
      module: "tvc",
      traceId: input.traceId,
      message: "TVC 视频剪辑合成异常"
    })
    return { ok: false, code: "VIDEO_EDIT_FAILED", message: "剪辑失败，请稍后重试", status: 500 }
  }
}
