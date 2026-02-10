import { readEnv } from "./env"
import { logger } from "@/shared/logger"

interface CozeImageResponse {
  data?: string
  url?: string
  image?: string
  image_url?: string
  image_type?: string
  prompt?: string
  [key: string]: unknown
}

/**
 * 从 Coze 返回数据中提取图片 URL
 * @param {CozeImageResponse} data - Coze 返回的 JSON
 * @returns {string | null} 图片 URL
 */
export function extractCozeImageUrl(data: CozeImageResponse): string | null {
  if (Array.isArray(data)) {
    for (const item of data) {
      if (typeof item === "string" && (item.startsWith("http") || item.startsWith("data:"))) return item
      if (item && typeof item === "object") {
        const nested = extractCozeImageUrl(item as CozeImageResponse)
        if (nested) return nested
      }
    }
  }
  if (data.data && typeof data.data === "string") return data.data
  if (data.url && typeof data.url === "string") return data.url
  if (data.image && typeof data.image === "string") return data.image
  if (data.image_url && typeof data.image_url === "string") return data.image_url
  if (data.data && typeof data.data === "object") {
    const nested = extractCozeImageUrl(data.data as CozeImageResponse)
    if (nested) return nested
  }

  const firstStringValue = Object.values(data).find(
    (val): val is string => typeof val === "string" && (val.startsWith("http") || val.startsWith("data:"))
  )
  const firstStringInArray = Object.values(data)
    .filter((val): val is unknown[] => Array.isArray(val))
    .flat()
    .find((val): val is string => typeof val === "string" && (val.startsWith("http") || val.startsWith("data:")))
  if (firstStringInArray) return firstStringInArray
  return firstStringValue || null
}

/**
 * 调用 Coze 生成图片
 * @param {string} prompt - 提示词
 * @param {string} imageType - 图片类型
 * @returns {Promise<string>} 图片 URL
 * @throws {Error} 调用失败或无法提取 URL 时抛出
 */
export async function generateImageByCoze(
  prompt: string,
  imageType: "background" | "role" | "item" = "item",
  options?: { traceId?: string; module?: string; style?: string }
): Promise<string> {
  const apiUrl =
    readEnv("REFERENCE_IMAGE_API_URL") || "https://bx3fr9ndvs.coze.site/run"
  const token = readEnv("REFERENCE_IMAGE_API_TOKEN")
  
  if (!token) {
    throw new Error("缺少环境变量 REFERENCE_IMAGE_API_URL/REFERENCE_IMAGE_API_TOKEN")
  }

  const traceId = options?.traceId ?? "unknown"
  const moduleName = options?.module ?? "coze"
  const style = typeof options?.style === "string" && options.style.trim() ? options.style.trim() : null
  const start = Date.now()
  let host = "unknown"
  let path = ""
  try {
    const u = new URL(apiUrl)
    host = u.host
    path = u.pathname
  } catch {}

  logger.info({
    event: "coze_image_generate_start",
    module: moduleName,
    traceId,
    message: "开始请求 Coze 生图",
    host,
    path,
    imageType,
    promptChars: prompt.trim().length
  })

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt: prompt.trim(), image_type: imageType, ...(style ? { style } : {}) }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    const durationMs = Date.now() - start
    logger.error({
      event: "coze_image_generate_failed",
      module: moduleName,
      traceId,
      message: "Coze 生图请求失败",
      host,
      path,
      imageType,
      status: response.status,
      durationMs,
      bodySnippet: errorText.slice(0, 500)
    })
    throw new Error(`Coze API 失败: ${response.status} ${errorText}`)
  }

  const data: CozeImageResponse = await response.json()
  const imageUrl = extractCozeImageUrl(data)
  if (!imageUrl) {
    const durationMs = Date.now() - start
    logger.error({
      event: "coze_image_generate_no_url",
      module: moduleName,
      traceId,
      message: "Coze 生图结果缺少可用 URL",
      host,
      path,
      imageType,
      durationMs
    })
    throw new Error("无法提取图片URL")
  }
  const durationMs = Date.now() - start
  logger.info({
    event: "coze_image_generate_success",
    module: moduleName,
    traceId,
    message: "Coze 生图请求成功",
    host,
    path,
    imageType,
    durationMs
  })
  return imageUrl
}
