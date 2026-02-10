import { NextResponse, type NextRequest } from "next/server"
import { sql } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { getTraceId } from "@/shared/trace"
import { logger } from "@/shared/logger"
import { CozeTtsClient } from "@/server/integrations/coze/ttsClient"
import { downloadBinary } from "@/server/lib/http/downloadBinary"
import { uploadPublicBuffer } from "@/shared/storage"
import { ttsSpeakerSamples } from "@/shared/schema/generation"
import { DEFAULT_TTS_TEST_TEXT, TTS_SPEAKERS } from "@/features/tts/speakers"

export const runtime = "nodejs"

export async function POST(req: NextRequest): Promise<Response> {
  if (process.env.NODE_ENV === "production") return NextResponse.json({ ok: false }, { status: 404 })

  const traceId = getTraceId(req.headers)
  const startedAt = Date.now()

  logger.info({
    event: "tts_seed_start",
    module: "tts",
    traceId,
    message: "开始批量生成音色样音并入库",
    speakerCount: TTS_SPEAKERS.length
  })

  try {
    const db = await getDb({ ttsSpeakerSamples })
    const results: Array<{ speaker: string; ok: boolean; id?: string; url?: string; message?: string }> = []

    for (const sp of TTS_SPEAKERS) {
      const existing = await db.execute(sql`
        SELECT id, url
        FROM tts_speaker_samples
        WHERE speaker_id = ${sp.id}
        LIMIT 1
      `)
      const rows = (existing as any)?.rows ?? []
      const hit = rows?.[0]
      if (hit?.id && hit?.url) {
        results.push({ speaker: sp.id, ok: true, id: String(hit.id), url: String(hit.url) })
        continue
      }

      try {
        const tts = await CozeTtsClient.synthesize({ text: DEFAULT_TTS_TEST_TEXT, speaker: sp.id, traceId })
        const downloaded = await downloadBinary(tts.audioUrl, traceId, 120_000)
        const contentType = downloaded.contentType ?? "audio/mpeg"
        const fileExt = contentType.includes("wav") ? "wav" : contentType.includes("mpeg") || contentType.includes("mp3") ? "mp3" : "bin"
        const uploaded = await uploadPublicBuffer({ buffer: downloaded.buffer, prefix: "tts-samples", contentType, fileExt })

        const upserted = await db.execute(sql`
          INSERT INTO tts_speaker_samples (speaker_id, speaker_name, sample_text, url, storage_key, audio_size)
          VALUES (${sp.id}, ${sp.name}, ${DEFAULT_TTS_TEST_TEXT}, ${uploaded.url}, ${uploaded.key}, ${tts.audioSize})
          ON CONFLICT (speaker_id)
          DO UPDATE SET
            speaker_name = EXCLUDED.speaker_name,
            sample_text = EXCLUDED.sample_text,
            url = EXCLUDED.url,
            storage_key = EXCLUDED.storage_key,
            audio_size = EXCLUDED.audio_size,
            created_at = now()
          RETURNING id
        `)

        const id = String(((upserted as any)?.rows?.[0]?.id ?? "") || "")
        if (id) {
          const stableUrl = `/api/tts/speakers/file/${id}`
          await db.execute(sql`
            UPDATE tts_speaker_samples
            SET url = ${stableUrl}
            WHERE id = ${id}
          `)
          results.push({ speaker: sp.id, ok: true, id, url: stableUrl })
        } else {
          results.push({ speaker: sp.id, ok: true, url: uploaded.url })
        }
      } catch (err) {
        const anyErr = err as { message?: string; name?: string }
        results.push({ speaker: sp.id, ok: false, message: anyErr?.message || anyErr?.name || "failed" })
      }
    }

    logger.info({
      event: "tts_seed_success",
      module: "tts",
      traceId,
      message: "批量生成音色样音完成",
      durationMs: Date.now() - startedAt,
      successCount: results.filter((r) => r.ok).length,
      failCount: results.filter((r) => !r.ok).length
    })

    return NextResponse.json(makeApiOk(traceId, { text: DEFAULT_TTS_TEST_TEXT, results }), { status: 200 })
  } catch (err) {
    const anyErr = err as { message?: string; name?: string; stack?: string }
    logger.error({
      event: "tts_seed_failed",
      module: "tts",
      traceId,
      message: "批量生成音色样音失败",
      durationMs: Date.now() - startedAt,
      errorName: anyErr?.name,
      errorMessage: anyErr?.message
    })
    return NextResponse.json(makeApiErr(traceId, "TTS_SEED_FAILED", anyErr?.message || "批量生成失败"), { status: 500 })
  }
}
