import { NextResponse } from "next/server"
import { z } from "zod"
import { eq } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { readEnv } from "@/features/coze/env"
import { callCozeRunEndpoint } from "@/features/coze/runEndpointClient"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { logger } from "@/shared/logger"
import { getTraceId } from "@/shared/trace"
import { storyboards } from "@/shared/schema"
import { mergeStoryboardFrames, mergeStoryboardVideoInfo } from "@/server/services/storyboardAssets"

const inputSchema = z.object({
  storyboardId: z.string().min(1)
})

type PromptFrame = {
  type: "image_url" | "prompt"
  content: string
}

type PromptLastFrame = {
  type: "prompt" | "None"
  content: string
}

type PromptOutput = {
  first_frame: PromptFrame
  last_frame: PromptLastFrame
  mode: string
  video_prompt: string
}

function asObject(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null
  return data as Record<string, unknown>
}

function readField<T = unknown>(data: unknown, key: string): T | undefined {
  const obj = asObject(data)
  if (!obj) return undefined
  if (key in obj) return obj[key] as T
  const nested = obj["data"]
  const nestedObj = asObject(nested)
  if (nestedObj && key in nestedObj) return nestedObj[key] as T
  return undefined
}

function normalizeToPromptOutput(cozeData: unknown): PromptOutput | null {
  const firstFrame = readField<unknown>(cozeData, "first_frame")
  const lastFrame = readField<unknown>(cozeData, "last_frame")
  const mode = readField<unknown>(cozeData, "mode")
  const videoPrompt = readField<unknown>(cozeData, "video_prompt")

  const firstObj = asObject(firstFrame)
  const lastObj = asObject(lastFrame)
  if (firstObj && lastObj && typeof mode === "string" && typeof videoPrompt === "string") {
    const type = firstObj["type"]
    const content = firstObj["content"]
    const lastType = lastObj["type"]
    const lastContent = lastObj["content"]
    if (
      (type === "image_url" || type === "prompt") &&
      typeof content === "string" &&
      (lastType === "prompt" || lastType === "None") &&
      typeof lastContent === "string"
    ) {
      return {
        first_frame: { type, content },
        last_frame: { type: lastType, content: lastContent },
        mode,
        video_prompt: videoPrompt
      }
    }
  }

  const firstFramePrompt = readField<unknown>(cozeData, "image_prompt")
  const imagePromptType = readField<unknown>(cozeData, "image_prompt_type")
  const legacyVideoPrompt = readField<unknown>(cozeData, "video_prompt")

  const normalizedFirstFramePrompt =
    typeof firstFramePrompt === "string"
      ? firstFramePrompt
      : firstFramePrompt
        ? JSON.stringify(firstFramePrompt)
        : ""
  const normalizedVideoPrompt =
    typeof legacyVideoPrompt === "string" ? legacyVideoPrompt : legacyVideoPrompt ? JSON.stringify(legacyVideoPrompt) : ""
  const normalizedMode =
    typeof imagePromptType === "string" ? imagePromptType : imagePromptType ? JSON.stringify(imagePromptType) : ""

  if (!normalizedFirstFramePrompt && !normalizedVideoPrompt) return null

  return {
    first_frame: { type: "prompt", content: normalizedFirstFramePrompt },
    last_frame: { type: "None", content: "" },
    mode: normalizedMode,
    video_prompt: normalizedVideoPrompt
  }
}

export async function POST(req: Request): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const start = Date.now()

  logger.info({
    event: "generate_prompts_start",
    module: "coze",
    traceId,
    message: "开始生成提示词"
  })

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json(makeApiErr(traceId, "INVALID_JSON", "请求体不是合法 JSON"), {
      status: 400
    })
  }

  const parsed = inputSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "入参格式不正确"), {
      status: 400
    })
  }

  const { storyboardId } = parsed.data

  const url = readEnv("COZE_PROMPT_API_URL")
  const token = readEnv("COZE_PROMPT_API_TOKEN")

  if (!url || !token) {
    return NextResponse.json(makeApiErr(traceId, "COZE_NOT_CONFIGURED", "Coze 提示词生成服务未配置"), {
      status: 500
    })
  }

  try {
    const db = await getDb({ storyboards })
    const rows = await db
      .select({ scriptContent: storyboards.scriptContent })
      .from(storyboards)
      .where(eq(storyboards.id, storyboardId))
      .limit(1)
    const script_json = rows[0]?.scriptContent

    if (!script_json) {
      return NextResponse.json(makeApiErr(traceId, "SCRIPT_NOT_FOUND", "未找到脚本内容，请先生成脚本"), {
        status: 404
      })
    }

    const coze = await callCozeRunEndpoint({
      traceId,
      url,
      token,
      body: script_json,
      module: "coze"
    })

    const durationMs = Date.now() - start
    
    const output = normalizeToPromptOutput(coze.data)
    if (!output) {
      logger.warn({
        event: "generate_prompts_empty",
        module: "coze",
        traceId,
        message: "Coze 返回结果中未找到提示词",
        data: coze.data
      })
      return NextResponse.json(makeApiErr(traceId, "COZE_RESPONSE_INVALID", "Coze 返回格式不正确"), { status: 502 })
    }

    const normalizedFirstFramePrompt =
      output.first_frame.type === "prompt" ? output.first_frame.content : null
    const normalizedFirstFrameUrl =
      output.first_frame.type === "image_url" ? output.first_frame.content : null
    const normalizedLastFramePrompt =
      output.last_frame.type === "prompt" ? output.last_frame.content : null
    const normalizedMode = output.mode ? output.mode : null
    const normalizedVideoPrompt = output.video_prompt ? output.video_prompt : null

    const existing = await db
      .select({ frames: storyboards.frames, videoInfo: storyboards.videoInfo })
      .from(storyboards)
      .where(eq(storyboards.id, storyboardId))
      .limit(1)
    const nextFrames = mergeStoryboardFrames(existing[0]?.frames as any, {
      first: {
        prompt: normalizedFirstFramePrompt,
        url: normalizedFirstFrameUrl
      },
      last: {
        prompt: normalizedLastFramePrompt
      }
    })
    const nextVideoInfo = mergeStoryboardVideoInfo(existing[0]?.videoInfo as any, {
      prompt: normalizedVideoPrompt,
      settings: { mode: normalizedMode }
    })

    await db.update(storyboards)
      .set({
        frames: nextFrames as any,
        videoInfo: nextVideoInfo as any,
        updatedAt: new Date()
      })
      .where(eq(storyboards.id, storyboardId))

    logger.info({
      event: "generate_prompts_success",
      module: "coze",
      traceId,
      message: "提示词生成并入库成功",
      durationMs,
      hasMode: Boolean(output?.mode)
    })

    return NextResponse.json(makeApiOk(traceId, output), { status: 200 })

  } catch (err) {
    const anyErr = err as { message?: string }
    logger.error({
      event: "generate_prompts_failed",
      module: "coze",
      traceId,
      message: "提示词生成失败",
      error: anyErr?.message
    })
    return NextResponse.json(makeApiErr(traceId, "GENERATION_FAILED", anyErr?.message || "生成失败"), {
      status: 500
    })
  }
}
