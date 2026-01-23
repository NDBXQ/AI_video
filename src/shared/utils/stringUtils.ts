import { createHash } from "crypto"

/**
 * 生成安全的对象存储键名片段
 * @param {string} input - 输入字符串
 * @param {number} maxLen - 最大长度
 * @returns {string} 安全的键名片段
 */
export function makeSafeObjectKeySegment(input: string, maxLen: number): string {
  const hash = createHash("sha1").update(input).digest("hex").slice(0, 10)
  const normalized = input
    .toLowerCase()
    .replaceAll(" ", "_")
    .replace(/[^a-z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_./-]+|[_./-]+$/g, "")
  const base = normalized ? `${normalized.slice(0, Math.max(1, maxLen - 11))}_${hash}` : `name_${hash}`
  return base.slice(0, maxLen)
}
