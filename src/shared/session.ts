import type { NextRequest } from "next/server"
import { logger } from "@/shared/logger"
import { getTraceId } from "@/shared/trace"

export const SESSION_COOKIE_NAME = "ai_video_session"

type SessionPayload = {
  userId: string
  account: string
  exp: number
}

/**
 * 获取会话签名密钥（服务端）
 * @param {string} traceId - 链路追踪 ID
 * @returns {string} 密钥
 */
function getSessionSecret(traceId: string): string {
  const secret = process.env.AUTH_SESSION_SECRET

  if (secret && secret.trim()) return secret.trim()

  if (process.env.NODE_ENV !== "production") {
    logger.warn({
      event: "auth_session_secret_missing",
      module: "auth",
      traceId,
      message: "AUTH_SESSION_SECRET 未设置，使用开发环境默认值"
    })
    return "dev-secret-please-set-auth_session_secret"
  }

  throw new Error("AUTH_SESSION_SECRET is required in production")
}

/**
 * 字节数组转二进制字符串（用于 btoa）
 * @param {Uint8Array} bytes - 字节数组
 * @returns {string} 二进制字符串
 */
function bytesToBinaryString(bytes: Uint8Array): string {
  let out = ""
  for (let i = 0; i < bytes.length; i += 1) {
    out += String.fromCharCode(bytes[i]!)
  }
  return out
}

/**
 * 二进制字符串转字节数组（用于 atob）
 * @param {string} str - 二进制字符串
 * @returns {Uint8Array} 字节数组
 */
function binaryStringToBytes(str: string): Uint8Array {
  const bytes = new Uint8Array(str.length)
  for (let i = 0; i < str.length; i += 1) {
    bytes[i] = str.charCodeAt(i)
  }
  return bytes
}

/**
 * Base64URL 编码
 * @param {Uint8Array} bytes - 原始二进制
 * @returns {string} 编码后字符串
 */
function base64UrlEncode(bytes: Uint8Array): string {
  const b64 = btoa(bytesToBinaryString(bytes))
  return b64.replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")
}

/**
 * Base64URL 解码
 * @param {string} str - 编码字符串
 * @returns {Uint8Array} 解码后的二进制
 */
function base64UrlDecode(str: string): Uint8Array {
  const padded = str.replaceAll("-", "+").replaceAll("_", "/")
  const padLen = (4 - (padded.length % 4)) % 4
  const withPad = padded + "=".repeat(padLen)
  return binaryStringToBytes(atob(withPad))
}

/**
 * 生成 HMAC-SHA256 签名
 * @param {string} secret - HMAC 密钥
 * @param {string} data - 待签名数据
 * @returns {Promise<Uint8Array>} 签名结果
 */
async function hmacSha256(secret: string, data: string): Promise<Uint8Array> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(data))
  return new Uint8Array(sigBuf)
}

/**
 * 常量时间比较（避免时序攻击）
 * @param {Uint8Array} a - 数组 A
 * @param {Uint8Array} b - 数组 B
 * @returns {boolean} 是否相等
 */
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i]! ^ b[i]!
  }
  return diff === 0
}

/**
 * 创建会话 token（HMAC 签名，httpOnly cookie 用）
 * @param {Object} input - token 输入
 * @param {string} input.userId - 用户 ID
 * @param {string} input.account - 账号
 * @param {number} input.ttlSeconds - token 有效期秒数
 * @param {string} traceId - 链路追踪 ID
 * @returns {Promise<string>} token 字符串
 */
export async function createSessionToken(
  input: { userId: string; account: string; ttlSeconds: number },
  traceId: string
): Promise<string> {
  const payload: SessionPayload = {
    userId: input.userId,
    account: input.account,
    exp: Math.floor(Date.now() / 1000) + input.ttlSeconds
  }

  const secret = getSessionSecret(traceId)
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)))
  const sig = await hmacSha256(secret, payloadB64)
  const sigB64 = base64UrlEncode(sig)
  return `${payloadB64}.${sigB64}`
}

/**
 * 校验并解析会话 token
 * @param {string} token - cookie token
 * @param {string} traceId - 链路追踪 ID
 * @returns {Promise<SessionPayload | null>} 会话负载或空
 */
export async function verifySessionToken(
  token: string,
  traceId: string
): Promise<SessionPayload | null> {
  const parts = token.split(".")
  if (parts.length !== 2) return null

  const [payloadB64, sigB64] = parts
  if (!payloadB64 || !sigB64) return null

  try {
    const secret = getSessionSecret(traceId)
    const expected = await hmacSha256(secret, payloadB64)
    const provided = base64UrlDecode(sigB64)

    if (!constantTimeEqual(provided, expected)) return null

    const payloadRaw = new TextDecoder().decode(base64UrlDecode(payloadB64))
    const payload = JSON.parse(payloadRaw) as SessionPayload

    if (!payload?.userId || !payload?.account || typeof payload?.exp !== "number") return null
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null

    return payload
  } catch {
    return null
  }
}

/**
 * 从请求中读取当前会话
 * @param {NextRequest} req - Next.js 请求对象
 * @returns {Promise<SessionPayload | null>} 会话或空
 */
export async function getSessionFromRequest(req: NextRequest): Promise<SessionPayload | null> {
  const traceId = getTraceId(req.headers)
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null
  return verifySessionToken(token, traceId)
}

/**
 * 构造 Set-Cookie 字符串
 * @param {Object} input - cookie 输入
 * @param {string} input.value - cookie 值
 * @param {number} input.maxAgeSeconds - 最大有效期秒数
 * @returns {string} Set-Cookie 字符串
 */
export function buildSessionSetCookie(input: {
  value: string
  maxAgeSeconds: number
}): string {
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : ""
  return `${SESSION_COOKIE_NAME}=${input.value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${input.maxAgeSeconds};${secure}`
}

/**
 * 构造清除会话 Cookie 的 Set-Cookie 字符串
 * @returns {string} Set-Cookie 字符串
 */
export function buildSessionClearCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : ""
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0;${secure}`
}
