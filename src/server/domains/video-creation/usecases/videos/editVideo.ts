import { getDb } from "coze-coding-dev-sdk"
import { and, eq } from "drizzle-orm"
import { stories } from "@/shared/schema/story"
import { resolveVideoEditUrls } from "@/server/domains/video-edit/resolveVideoEditUrls"
import { readEnv, readEnvInt } from "@/features/coze/env"
import { callCozeRunEndpoint, CozeRunEndpointError } from "@/features/coze/runEndpointClient"
import { logger } from "@/shared/logger"
import { z } from "zod"

const outputSchema = z
  .object({
    output_video_url: z.string().trim().url().max(5_000).optional(),
    final_video_url: z.string().trim().url().max(5_000).optional(),
    video_meta: z.unknown().optional()
  })
  .refine((v) => Boolean(v.output_video_url || v.final_video_url), { message: "缺少 output_video_url / final_video_url" })

export async function editVideoByConfig(input: {
  traceId: string
  userId: string
  storyId: string
  origin: string
  video_config_list: Array<{ url: string; start_time: number; end_time: number }>
  audio_config_list: Array<{ url: string; start_time: number; end_time: number; timeline_start: number }>
}): Promise<
  | { ok: true; output_video_url: string; video_meta: unknown }
  | { ok: false; code: string; message: string; status: number }
> {
  const token = readEnv("VIDEO_EDIT_API_TOKEN")
  const url = readEnv("VIDEO_EDIT_API_URL") ?? "https://h4y9qnk5qt.coze.site/run"
  if (!token) return { ok: false, code: "COZE_NOT_CONFIGURED", message: "未配置 VIDEO_EDIT_API_TOKEN", status: 500 }

  const timeoutMs = readEnvInt("REQUEST_TIMEOUT_MS") ?? 120_000
  const startedAt = performance.now()

  logger.info({
    event: "video_edit_start",
    module: "video-edit",
    traceId: input.traceId,
    message: "开始请求视频剪辑合成",
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
        event: "video_edit_invalid_response",
        module: "video-edit",
        traceId: input.traceId,
        message: "剪辑接口返回格式不符合预期",
        durationMs: Math.round(performance.now() - startedAt)
      })
      return { ok: false, code: "VIDEO_EDIT_INVALID_RESPONSE", message: "剪辑接口返回格式不符合预期", status: 502 }
    }

    logger.info({
      event: "video_edit_success",
      module: "video-edit",
      traceId: input.traceId,
      message: "视频剪辑合成成功",
      durationMs: Math.round(performance.now() - startedAt)
    })

    const resultUrl = (normalized.data.output_video_url ?? normalized.data.final_video_url ?? "").trim()
    const db = await getDb({ stories })
    const saved = await db
      .update(stories)
      .set({ finalVideoUrl: resultUrl, updatedAt: new Date() })
      .where(and(eq(stories.id, input.storyId), eq(stories.userId, input.userId)))
      .returning({ id: stories.id })

    if (saved.length === 0) {
      return { ok: false, code: "STORY_NOT_FOUND", message: "未找到可写入的剧本", status: 404 }
    }

    return { ok: true, output_video_url: resultUrl, video_meta: normalized.data.video_meta ?? null }
  } catch (err) {
    const durationMs = Math.round(performance.now() - startedAt)
    if (err instanceof CozeRunEndpointError) {
      logger.error({
        event: "video_edit_failed",
        module: "video-edit",
        traceId: input.traceId,
        message: "剪辑接口调用失败",
        durationMs,
        errorName: err.name,
        errorMessage: err.message
      })
      return { ok: false, code: "VIDEO_EDIT_REQUEST_FAILED", message: "剪辑接口调用失败", status: 502 }
    }

    const anyErr = err as { name?: string; message?: string; stack?: string }
    logger.error({
      event: "video_edit_failed",
      module: "video-edit",
      traceId: input.traceId,
      message: "视频剪辑合成失败",
      durationMs,
      errorName: anyErr?.name,
      errorMessage: anyErr?.message
    })
    return { ok: false, code: "VIDEO_EDIT_FAILED", message: anyErr?.message || "视频剪辑合成失败", status: 500 }
  }
}
