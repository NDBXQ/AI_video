import { getDb } from "coze-coding-dev-sdk"
import { and, eq } from "drizzle-orm"
import { generatedAudios } from "@/shared/schema/generation"
import { stories, storyOutlines, storyboards } from "@/shared/schema/story"
import { CozeTtsClient } from "@/server/integrations/coze/ttsClient"
import { downloadBinary } from "@/server/lib/http/downloadBinary"
import { uploadPublicBuffer } from "@/shared/storage"
import { getSpeakerName } from "@/features/tts/speakers"
import { logger } from "@/shared/logger"

export async function generateVideoCreationAudio(input: {
  traceId: string
  userId: string
  storyboardId: string
  roleName: string
  text: string
  speakerId: string
}): Promise<
  | { ok: true; audioId: string; audioUrl: string; audioSize: number | null }
  | { ok: false; code: string; message: string; status: number }
> {
  const startedAt = Date.now()
  const speakerName = getSpeakerName(input.speakerId) ?? input.speakerId

  logger.info({
    event: "tts_generate_audio_start",
    module: "tts",
    traceId: input.traceId,
    message: "开始生成分镜台词音频",
    storyboardId: input.storyboardId,
    speakerId: input.speakerId
  })

  try {
    const db = await getDb({ generatedAudios, stories, storyOutlines, storyboards })
    const allowed = await db
      .select({ storyId: stories.id })
      .from(storyboards)
      .innerJoin(storyOutlines, eq(storyboards.outlineId, storyOutlines.id))
      .innerJoin(stories, eq(storyOutlines.storyId, stories.id))
      .where(and(eq(storyboards.id, input.storyboardId), eq(stories.userId, input.userId)))
      .limit(1)
    const storyId = allowed[0]?.storyId ?? null
    if (!storyId) return { ok: false, code: "STORYBOARD_NOT_FOUND", message: "未找到可用的分镜", status: 404 }

    const tts = await CozeTtsClient.synthesize({ text: input.text, speaker: input.speakerId, traceId: input.traceId })
    const downloaded = await downloadBinary(tts.audioUrl, input.traceId, 120_000)
    const contentType = downloaded.contentType ?? "audio/mpeg"
    const fileExt = contentType.includes("wav") ? "wav" : contentType.includes("mpeg") || contentType.includes("mp3") ? "mp3" : "bin"
    const uploaded = await uploadPublicBuffer({ buffer: downloaded.buffer, prefix: "generated-audios", contentType, fileExt })

    const inserted = await db
      .insert(generatedAudios)
      .values({
        storyId,
        storyboardId: input.storyboardId,
        roleName: input.roleName,
        speakerId: input.speakerId,
        speakerName,
        content: input.text,
        url: uploaded.url,
        storageKey: uploaded.key,
        audioSize: tts.audioSize
      } as any)
      .returning({ id: generatedAudios.id })

    const id = inserted?.[0]?.id ? String(inserted[0].id) : ""
    const stableUrl = id ? `/api/video-creation/audios/file/${id}` : uploaded.url
    if (id) await db.update(generatedAudios).set({ url: stableUrl }).where(eq(generatedAudios.id, id))

    logger.info({
      event: "tts_generate_audio_success",
      module: "tts",
      traceId: input.traceId,
      message: "生成分镜台词音频成功",
      durationMs: Date.now() - startedAt,
      storyboardId: input.storyboardId,
      audioId: id
    })

    return { ok: true, audioId: id, audioUrl: stableUrl, audioSize: tts.audioSize }
  } catch (err) {
    const durationMs = Date.now() - startedAt
    const anyErr = err as { name?: string; message?: string; stack?: string }
    logger.error({
      event: "tts_generate_audio_failed",
      module: "tts",
      traceId: input.traceId,
      message: "生成分镜台词音频失败",
      durationMs,
      errorName: anyErr?.name,
      errorMessage: anyErr?.message
    })
    return { ok: false, code: "TTS_GENERATE_FAILED", message: anyErr?.message || "生成音频失败", status: 500 }
  }
}
