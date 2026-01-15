import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto"
import { promisify } from "util"

const scrypt = promisify(scryptCallback)

/**
 * 对密码进行加盐哈希
 * @param {string} password - 明文密码
 * @returns {Promise<string>} 可持久化的哈希字符串
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex")
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer
  return `scrypt$${salt}$${derivedKey.toString("hex")}`
}

/**
 * 校验明文密码与哈希是否匹配
 * @param {string} password - 明文密码
 * @param {string} passwordHash - 持久化的哈希字符串
 * @returns {Promise<boolean>} 是否匹配
 */
export async function verifyPassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  if (!passwordHash.startsWith("scrypt$")) {
    const a = Buffer.from(password)
    const b = Buffer.from(passwordHash)
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  }

  const parts = passwordHash.split("$")
  if (parts.length !== 3) {
    return false
  }

  const [algorithm, salt, expectedHex] = parts
  if (algorithm !== "scrypt") {
    return false
  }

  const expected = Buffer.from(expectedHex, "hex")
  const derivedKey = (await scrypt(password, salt, expected.length)) as Buffer
  if (derivedKey.length !== expected.length) {
    return false
  }

  return timingSafeEqual(derivedKey, expected)
}
