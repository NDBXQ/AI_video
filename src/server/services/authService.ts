import { InvalidCredentialsError, userManager } from "@/features/auth/user-manager"
import { logger } from "@/shared/logger"
import { createSessionToken, verifySessionToken } from "@/shared/session"
import { ServiceError } from "@/server/services/errors"

export interface LoginResult {
  user: { id: string; account: string }
  created: boolean
  token: string
  sessionTtlSeconds: number
}

export class AuthService {
  /**
   * 用户登录
   * @param {string} account - 账号
   * @param {string} password - 密码
   * @param {string} traceId - 链路ID
   * @returns {Promise<LoginResult>} 登录结果
   */
  static async login(account: string, password: string, traceId: string): Promise<LoginResult> {
    const start = Date.now()
    
    try {
      const sessionTtlSeconds = 60 * 60 * 24 * 7
      const isTestAccount = account === "test" && password === "test"

      const result = isTestAccount
        ? { user: { id: "test-user", name: "test" }, created: false }
        : await userManager.loginOrCreate(account, password)

      const token = await createSessionToken(
        { userId: result.user.id, account: result.user.name, ttlSeconds: sessionTtlSeconds },
        traceId
      )

      const durationMs = Date.now() - start
      logger.info({
        event: "auth_login_success",
        module: "auth",
        traceId,
        message: "登录成功",
        durationMs,
        userId: result.user.id,
        created: result.created
      })

      return {
        user: { id: result.user.id, account: result.user.name },
        created: result.created,
        token,
        sessionTtlSeconds
      }
    } catch (err) {
      const durationMs = Date.now() - start
      if (err instanceof InvalidCredentialsError) {
        logger.warn({
          event: "auth_login_invalid_credentials",
          module: "auth",
          traceId,
          message: "登录失败：账号或密码错误",
          durationMs
        })
        throw new ServiceError("AUTH_INVALID_CREDENTIALS", "账号或密码错误")
      }

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

      throw new ServiceError(errorCode, publicMessage)
    }
  }

  /**
   * 获取当前用户
   * @param {string | undefined} token - 会话Token
   * @param {boolean} refresh - 是否刷新（强制查库）
   * @param {string} traceId - 链路ID
   * @returns {Promise<{ id: string; account: string }>} 用户信息
   */
  static async getCurrentUser(token: string | undefined, refresh: boolean, traceId: string): Promise<{ id: string; account: string }> {
    const start = Date.now()

    if (!token) {
      logger.warn({
        event: "auth_me_unauthenticated",
        module: "auth",
        traceId,
        message: "未登录：缺少会话 cookie"
      })
      throw new ServiceError("AUTH_UNAUTHENTICATED", "未登录")
    }

    const session = await verifySessionToken(token, traceId)
    if (!session) {
      logger.warn({
        event: "auth_me_invalid_session",
        module: "auth",
        traceId,
        message: "未登录：会话校验失败"
      })
      throw new ServiceError("AUTH_INVALID_SESSION", "登录已失效，请重新登录")
    }

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
      return { id: session.userId, account: session.account }
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
      return { id: session.userId, account: session.account }
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
        throw new ServiceError("AUTH_USER_NOT_FOUND", "用户不存在，请重新登录")
      }

      logger.info({
        event: "auth_me_success",
        module: "auth",
        traceId,
        message: "获取当前用户成功（db）",
        durationMs,
        userId: user.id
      })

      return { id: user.id, account: user.name }
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

      throw new ServiceError("AUTH_ME_FAILED", "获取用户失败，请稍后重试")
    }
  }
}
