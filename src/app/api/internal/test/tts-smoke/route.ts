import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { getTraceId } from "@/shared/trace"
import { CozeTtsClient } from "@/server/integrations/coze/ttsClient"
import { DEFAULT_TTS_TEST_TEXT, TTS_SPEAKERS } from "@/features/tts/speakers"

const inputSchema = z.object({
  speaker: z.string().trim().min(1).max(200).optional(),
  text: z.string().trim().min(1).max(5000).optional()
})

export const runtime = "nodejs"

export async function POST(req: NextRequest): Promise<Response> {
  const traceId = getTraceId(req.headers)

  const body = await req.json().catch(() => null)
  const parsed = inputSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })

  const speaker = parsed.data.speaker ?? TTS_SPEAKERS[0]?.id ?? ""
  if (!speaker) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "缺少 speaker"), { status: 400 })

  try {
    const { audioUrl, audioSize } = await CozeTtsClient.synthesize({ text: parsed.data.text ?? DEFAULT_TTS_TEST_TEXT, speaker, traceId })
    return NextResponse.json(makeApiOk(traceId, { audio_url: audioUrl, audio_size: audioSize, speaker }), { status: 200 })
  } catch (err) {
    const anyErr = err as { message?: string }
    return NextResponse.json(makeApiErr(traceId, "TTS_SMOKE_FAILED", anyErr?.message || "TTS 测试失败"), { status: 500 })
  }
}
