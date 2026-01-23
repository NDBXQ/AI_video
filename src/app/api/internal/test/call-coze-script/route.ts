import { NextResponse } from "next/server"
import { z } from "zod"
import { readEnv } from "@/features/coze/env"
import { callCozeRunEndpoint } from "@/features/coze/runEndpointClient"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { logger } from "@/shared/logger"
import { getTraceId } from "@/shared/trace"

const inputSchema = z.object({
  raw_script: z.string().min(1).max(80_000),
  demand: z.string().min(1).max(10_000)
})

export async function POST(req: Request): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const start = Date.now()

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json(makeApiErr(traceId, "INVALID_JSON", "请求体不是合法 JSON"), { status: 400 })
  }

  const parsed = inputSchema.safeParse(json)
  if (!parsed.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "入参格式不正确"), { status: 400 })

  const url = readEnv("COZE_SCRIPT_API_URL")
  const token = readEnv("COZE_SCRIPT_API_TOKEN")
  if (!url || !token) return NextResponse.json(makeApiErr(traceId, "COZE_NOT_CONFIGURED", "Coze 脚本服务未配置"), { status: 500 })

  logger.info({
    event: "internal_call_coze_script_start",
    module: "internal",
    traceId,
    message: "开始探测 Coze 脚本回包结构"
  })

  const coze = await callCozeRunEndpoint({ traceId, url, token, body: parsed.data, module: "internal" })

  const durationMs = Date.now() - start
  const data = coze.data
  const summary =
    data && typeof data === "object" && !Array.isArray(data)
      ? { topKeys: Object.keys(data as Record<string, unknown>).slice(0, 30) }
      : { type: Array.isArray(data) ? "array" : data === null ? "null" : typeof data }

  logger.info({
    event: "internal_call_coze_script_success",
    module: "internal",
    traceId,
    message: "Coze 脚本回包探测完成",
    durationMs,
    ...summary
  })

  return NextResponse.json(makeApiOk(traceId, { durationMs, data, summary }), { status: 200 })
}

