import { eq } from "drizzle-orm"
import { getDb } from "@/server/db/getDb"
import { insertUserSchema, updateUserSchema, users, type InsertUser, type UpdateUser, type User } from "@/shared/schema/auth"
import { hashPassword, verifyPassword } from "./password"
import { ensurePublicSchema } from "@/server/db/ensurePublicSchema"

export class InvalidCredentialsError extends Error {
  name = "InvalidCredentialsError"
}

/**
 * 将账号转为 users.email 中的唯一键
 * @param {string} account - 账号
 * @returns {string} 唯一键
 */
function toAccountEmailKey(account: string): string {
  return `account:${account.trim()}`
}

export class UserManager {
  /**
   * 创建新用户
   * @param {InsertUser} data - 用户写入数据
   * @returns {Promise<User>} 创建后的用户
   */
  async createUser(data: InsertUser): Promise<User> {
    await ensurePublicSchema()
    const db = await getDb({ users })
    const validated = insertUserSchema.parse(data)
    const [user] = await db.insert(users).values(validated).returning()
    return user
  }

  /**
   * 根据 ID 获取用户
   * @param {string} id - 用户 ID
   * @returns {Promise<User | null>} 用户或空
   */
  async getUserById(id: string): Promise<User | null> {
    await ensurePublicSchema()
    const db = await getDb({ users })
    const [user] = await db.select().from(users).where(eq(users.id, id))
    return user || null
  }

  /**
   * 根据账号获取用户
   * @param {string} account - 账号
   * @returns {Promise<User | null>} 用户或空
   */
  async getUserByAccount(account: string): Promise<User | null> {
    await ensurePublicSchema()
    const db = await getDb({ users })
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, toAccountEmailKey(account)))
    return user || null
  }

  /**
   * 更新用户
   * @param {string} id - 用户 ID
   * @param {UpdateUser} data - 更新数据
   * @returns {Promise<User | null>} 更新后的用户或空
   */
  async updateUser(id: string, data: UpdateUser): Promise<User | null> {
    await ensurePublicSchema()
    const db = await getDb({ users })
    const validated = updateUserSchema.parse(data)
    const [user] = await db
      .update(users)
      .set({ ...validated, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning()
    return user || null
  }

  /**
   * 通过账号与密码进行“登录或创建”
   * @param {string} account - 账号
   * @param {string} password - 明文密码
   * @returns {Promise<{ user: User; created: boolean }>} 用户与是否新建
   */
  async loginOrCreate(
    account: string,
    password: string
  ): Promise<{ user: User; created: boolean }> {
    const existing = await this.getUserByAccount(account)
    if (!existing) {
      const passwordHash = await hashPassword(password)
      const user = await this.createUser({
        name: account.trim(),
        email: toAccountEmailKey(account),
        password: passwordHash
      })
      return { user, created: true }
    }

    const ok = await verifyPassword(password, existing.password)
    if (!ok) {
      throw new InvalidCredentialsError("账号或密码错误")
    }

    if (!existing.password.startsWith("scrypt$")) {
      const upgraded = await this.updateUser(existing.id, {
        password: await hashPassword(password)
      })
      if (upgraded) {
        return { user: upgraded, created: false }
      }
    }

    return { user: existing, created: false }
  }
}

export const userManager = new UserManager()
