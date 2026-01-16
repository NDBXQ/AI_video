import { NextResponse } from "next/server"
import { z } from "zod"
import { logger } from "@/shared/logger"
import { buildSessionSetCookie, createSessionToken } from "@/shared/session"
import { getTraceId } from "@/shared/trace"

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
 * 登录接口（测试阶段：仅允许 test/test）
 * @param {Request} req - HTTP 请求
 * @returns {Promise<Response>} JSON 响应
 */
export async function POST(req: Request): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const start = Date.now()

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
    const durationMs = Date.now() - start
    const isTestAccount = account === "test" && password === "test"
    if (!isTestAccount) {
      logger.warn({
        event: "auth_login_invalid_credentials",
        module: "auth",
        traceId,
        message: "登录失败：账号或密码错误（测试阶段仅允许 test/test）",
        durationMs
      })

      const body: ApiErr = {
        ok: false,
        error: { code: "AUTH_INVALID_CREDENTIALS", message: "账号或密码错误" },
        traceId
      }
      return NextResponse.json(body, { status: 401 })
    }

    const sessionTtlSeconds = 60 * 60 * 24 * 7
    const token = await createSessionToken(
      {
        userId: "test-user",
        account: "test",
        ttlSeconds: sessionTtlSeconds
      },
      traceId
    )

    logger.info({
      event: "auth_login_success",
      module: "auth",
      traceId,
      message: "登录成功",
      durationMs,
      userId: "test-user",
      created: false
    })

    const body: ApiOk<{
      user: { id: string; account: string }
      created: boolean
    }> = {
      ok: true,
      data: {
        user: { id: "test-user", account: "test" },
        created: false
      },
      traceId
    }
    const res = NextResponse.json(body, { status: 200 })
    res.headers.set(
      "set-cookie",
      buildSessionSetCookie({ value: token, maxAgeSeconds: sessionTtlSeconds })
    )
    return res
  } catch (err) {
    const durationMs = Date.now() - start

    const anyErr = err as {
      message?: string
      name?: string
      stack?: string
      code?: string
      constraint?: string
    }
    const errorCode =
      anyErr?.code === "42P01"
        ? "DB_TABLE_MISSING"
        : anyErr?.code === "42703"
          ? "DB_SCHEMA_MISMATCH"
          : anyErr?.code === "23505"
            ? "DB_CONSTRAINT_VIOLATION"
        : anyErr?.message?.includes("PGDATABASE_URL")
          ? "DB_NOT_CONFIGURED"
          : "AUTH_UNKNOWN"

    logger.error({
      event: "auth_login_failed",
      module: "auth",
      traceId,
      message: "登录处理失败",
      durationMs,
      errorName: anyErr?.name,
      errorMessage: anyErr?.message,
      stack: anyErr?.stack,
      code: anyErr?.code,
      constraint: anyErr?.constraint
    })

    const publicMessage =
      errorCode === "DB_TABLE_MISSING"
        ? "users 表不存在，请先创建表结构"
        : errorCode === "DB_SCHEMA_MISMATCH"
          ? "users 表结构与当前代码不匹配"
          : errorCode === "DB_CONSTRAINT_VIOLATION"
            ? "数据冲突，请更换账号或稍后重试"
        : errorCode === "DB_NOT_CONFIGURED"
          ? "数据库未配置，请设置 PGDATABASE_URL"
          : "登录失败，请稍后重试"

    const body: ApiErr = {
      ok: false,
      error: { code: errorCode, message: publicMessage },
      traceId
    }

    return NextResponse.json(body, { status: 500 })
  }
}
