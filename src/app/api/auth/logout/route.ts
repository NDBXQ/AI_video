import { NextResponse } from "next/server"
import { logger } from "@/shared/logger"
import { buildSessionClearCookie } from "@/shared/session"
import { getTraceId } from "@/shared/trace"

type ApiOk<T> = {
  ok: true
  data: T
  traceId: string
}

/**
 * 退出登录（清除会话 cookie）
 * @param {Request} req - HTTP 请求
 * @returns {Promise<Response>} JSON 响应
 */
export async function POST(req: Request): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const start = Date.now()

  logger.info({
    event: "auth_logout_start",
    module: "auth",
    traceId,
    message: "开始退出登录"
  })

  const durationMs = Date.now() - start
  logger.info({
    event: "auth_logout_success",
    module: "auth",
    traceId,
    message: "退出登录成功",
    durationMs
  })

  const body: ApiOk<{ cleared: true }> = { ok: true, data: { cleared: true }, traceId }
  const res = NextResponse.json(body, { status: 200 })
  res.headers.set("set-cookie", buildSessionClearCookie())
  return res
}

