import { NextResponse } from "next/server"
import { z } from "zod"
import { logger } from "@/shared/logger"
import { SESSION_COOKIE_NAME } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { AuthService } from "@/server/services/authService"
import { ServiceError } from "@/server/services/errors"

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

const querySchema = z.object({
  refresh: z.enum(["0", "1"]).optional()
})

/**
 * 获取当前登录用户
 * @param {Request} req - HTTP 请求
 * @returns {Promise<Response>} JSON 响应
 */
export async function GET(req: Request): Promise<Response> {
  const traceId = getTraceId(req.headers)

  logger.info({
    event: "auth_me_start",
    module: "auth",
    traceId,
    message: "开始获取当前用户"
  })

  const url = new URL(req.url)
  const parsedQuery = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()))
  if (!parsedQuery.success) {
    const body: ApiErr = {
      ok: false,
      error: { code: "AUTH_VALIDATION_FAILED", message: "请求参数不正确" },
      traceId
    }
    return NextResponse.json(body, { status: 400 })
  }

  const cookieHeader = req.headers.get("cookie") ?? ""
  const token = cookieHeader
    .split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(`${SESSION_COOKIE_NAME}=`))
    ?.slice(`${SESSION_COOKIE_NAME}=`.length)

  const refresh = parsedQuery.data.refresh === "1"

  try {
    const user = await AuthService.getCurrentUser(token, refresh, traceId)

    const body: ApiOk<{ user: { id: string; account: string } }> = {
      ok: true,
      data: { user },
      traceId
    }
    return NextResponse.json(body, { status: 200 })
  } catch (err) {
    if (err instanceof ServiceError) {
      let status = 500
      if (["AUTH_UNAUTHENTICATED", "AUTH_INVALID_SESSION", "AUTH_USER_NOT_FOUND"].includes(err.code)) {
        status = 401
      }
      const body: ApiErr = {
        ok: false,
        error: { code: err.code, message: err.message },
        traceId
      }
      return NextResponse.json(body, { status })
    }

    const anyErr = err as { name?: string; message?: string; stack?: string }
    logger.error({
      event: "auth_me_failed",
      module: "auth",
      traceId,
      message: "获取当前用户失败（未知错误）",
      errorName: anyErr?.name,
      errorMessage: anyErr?.message,
      stack: anyErr?.stack
    })

    const body: ApiErr = {
      ok: false,
      error: { code: "AUTH_ME_FAILED", message: "获取用户失败，请稍后重试" },
      traceId
    }
    return NextResponse.json(body, { status: 500 })
  }
}
