import { NextResponse } from "next/server"
import { z } from "zod"
import { logger } from "@/shared/logger"
import { buildSessionSetCookie } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { AuthService } from "@/server/domains/auth/services/authService"
import { ServiceError } from "@/server/shared/errors"

const loginInputSchema = z.object({
  account: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(200)
})

type ApiOk<T> = {
  ok: true
  data: T
  traceId: string
}

type ApiErr = {
  ok: false
  error: { code: string; message: string }
  traceId: string
}

/**
 * 登录接口（测试阶段：test/test 免数据库验证）
 * @param {Request} req - HTTP 请求
 * @returns {Promise<Response>} JSON 响应
 */
export async function POST(req: Request): Promise<Response> {
  const traceId = getTraceId(req.headers)

  logger.info({
    event: "auth_login_start",
    module: "auth",
    traceId,
    message: "开始处理登录请求"
  })

  let json: unknown
  try {
    json = await req.json()
  } catch {
    const body: ApiErr = {
      ok: false,
      error: { code: "AUTH_INVALID_JSON", message: "请求体不是合法 JSON" },
      traceId
    }
    return NextResponse.json(body, { status: 400 })
  }

  const parsed = loginInputSchema.safeParse(json)
  if (!parsed.success) {
    logger.warn({
      event: "auth_login_validation_failed",
      module: "auth",
      traceId,
      message: "登录入参校验失败"
    })

    const body: ApiErr = {
      ok: false,
      error: { code: "AUTH_VALIDATION_FAILED", message: "账号或密码格式不正确" },
      traceId
    }
    return NextResponse.json(body, { status: 400 })
  }

  const { account, password } = parsed.data

  try {
    const result = await AuthService.login(account, password, traceId)

    const body: ApiOk<{
      user: { id: string; account: string }
      created: boolean
    }> = {
      ok: true,
      data: {
        user: result.user,
        created: result.created
      },
      traceId
    }
    const res = NextResponse.json(body, { status: 200 })
    res.headers.set(
      "set-cookie",
      buildSessionSetCookie({ value: result.token, maxAgeSeconds: result.sessionTtlSeconds })
    )
    return res
  } catch (err) {
    if (err instanceof ServiceError) {
      let status = 500
      if (err.code === "AUTH_INVALID_CREDENTIALS") status = 401
      
      const body: ApiErr = {
        ok: false,
        error: { code: err.code, message: err.message },
        traceId
      }
      return NextResponse.json(body, { status })
    }

    const anyErr = err as { name?: string; message?: string; stack?: string }
    logger.error({
      event: "auth_login_failed",
      module: "auth",
      traceId,
      message: "登录处理失败（未知错误）",
      errorName: anyErr?.name,
      errorMessage: anyErr?.message,
      stack: anyErr?.stack
    })

    const body: ApiErr = {
      ok: false,
      error: { code: "AUTH_UNKNOWN", message: "登录失败，请稍后重试" },
      traceId
    }

    return NextResponse.json(body, { status: 500 })
  }
}
