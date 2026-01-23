type LogLevel = "debug" | "info" | "warn" | "error"

type LogPayload = Record<string, unknown> & {
  event: string
  module: string
  traceId: string
  message: string
}

/**
 * 输出结构化日志
 * @param {LogLevel} level - 日志级别
 * @param {LogPayload} payload - 日志负载
 * @returns {void} 无返回值
 */
function log(level: LogLevel, payload: LogPayload): void {
  const record = {
    level,
    timestamp: new Date().toISOString(),
    ...payload
  }
  const headline = `${payload.module}:${payload.event} ${payload.message}`

  if (level === "error") {
    console.error(headline, record)
    return
  }

  if (level === "warn") {
    console.warn(headline, record)
    return
  }

  if (level === "info") {
    console.info(headline, record)
    return
  }

  console.debug(headline, record)
}

export const logger = {
  /**
   * 输出 debug 日志
   * @param {LogPayload} payload - 日志负载
   * @returns {void} 无返回值
   */
  debug(payload: LogPayload): void {
    log("debug", payload)
  },
  /**
   * 输出 info 日志
   * @param {LogPayload} payload - 日志负载
   * @returns {void} 无返回值
   */
  info(payload: LogPayload): void {
    log("info", payload)
  },
  /**
   * 输出 warn 日志
   * @param {LogPayload} payload - 日志负载
   * @returns {void} 无返回值
   */
  warn(payload: LogPayload): void {
    log("warn", payload)
  },
  /**
   * 输出 error 日志
   * @param {LogPayload} payload - 日志负载
   * @returns {void} 无返回值
   */
  error(payload: LogPayload): void {
    log("error", payload)
  }
}
