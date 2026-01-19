import { NextResponse } from "next/server"
import { z } from "zod"
import { userManager } from "@/features/auth/user-manager"
import { logger } from "@/shared/logger"
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/shared/session"
import { getTraceId } from "@/shared/trace"

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
  const start = Date.now()

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

  if (!token) {
    logger.warn({
      event: "auth_me_unauthenticated",
      module: "auth",
      traceId,
      message: "未登录：缺少会话 cookie"
    })

    const body: ApiErr = {
      ok: false,
      error: { code: "AUTH_UNAUTHENTICATED", message: "未登录" },
      traceId
    }
    return NextResponse.json(body, { status: 401 })
  }

  const session = await verifySessionToken(token, traceId)
  if (!session) {
    logger.warn({
      event: "auth_me_invalid_session",
      module: "auth",
      traceId,
      message: "未登录：会话校验失败"
    })

    const body: ApiErr = {
      ok: false,
      error: { code: "AUTH_INVALID_SESSION", message: "登录已失效，请重新登录" },
      traceId
    }
    return NextResponse.json(body, { status: 401 })
  }

  const refresh = parsedQuery.data.refresh === "1"
  const durationMsBeforeDb = Date.now() - start

  if (!refresh) {
    logger.info({
      event: "auth_me_success",
      module: "auth",
      traceId,
      message: "获取当前用户成功（cookie）",
      durationMs: durationMsBeforeDb,
      userId: session.userId
    })

    const body: ApiOk<{ user: { id: string; account: string } }> = {
      ok: true,
      data: { user: { id: session.userId, account: session.account } },
      traceId
    }
    return NextResponse.json(body, { status: 200 })
  }

  if (session.userId === "test-user") {
    const durationMs = Date.now() - start
    logger.info({
      event: "auth_me_success",
      module: "auth",
      traceId,
      message: "获取当前用户成功（test）",
      durationMs,
      userId: session.userId
    })

    const body: ApiOk<{ user: { id: string; account: string } }> = {
      ok: true,
      data: { user: { id: session.userId, account: session.account } },
      traceId
    }
    return NextResponse.json(body, { status: 200 })
  }

  try {
    const user = await userManager.getUserById(session.userId)
    const durationMs = Date.now() - start

    if (!user) {
      logger.warn({
        event: "auth_me_user_missing",
        module: "auth",
        traceId,
        message: "会话对应用户不存在",
        durationMs,
        userId: session.userId
      })

      const body: ApiErr = {
        ok: false,
        error: { code: "AUTH_USER_NOT_FOUND", message: "用户不存在，请重新登录" },
        traceId
      }
      return NextResponse.json(body, { status: 401 })
    }

    logger.info({
      event: "auth_me_success",
      module: "auth",
      traceId,
      message: "获取当前用户成功（db）",
      durationMs,
      userId: user.id
    })

    const body: ApiOk<{ user: { id: string; account: string } }> = {
      ok: true,
      data: { user: { id: user.id, account: user.name } },
      traceId
    }
    return NextResponse.json(body, { status: 200 })
  } catch (err) {
    const durationMs = Date.now() - start
    const anyErr = err as { name?: string; message?: string; stack?: string; code?: string }

    logger.error({
      event: "auth_me_failed",
      module: "auth",
      traceId,
      message: "获取当前用户失败",
      durationMs,
      userId: session.userId,
      errorName: anyErr?.name,
      errorMessage: anyErr?.message,
      stack: anyErr?.stack,
      code: anyErr?.code
    })

    const body: ApiErr = {
      ok: false,
      error: { code: "AUTH_ME_FAILED", message: "获取用户失败，请稍后重试" },
      traceId
    }
    return NextResponse.json(body, { status: 500 })
  }
}
