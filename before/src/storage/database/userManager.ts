import { eq } from "drizzle-orm";
import { getDb } from "coze-coding-dev-sdk";
import { users, insertUserSchema, updateUserSchema } from "./shared/schema";
import type { User, InsertUser, UpdateUser } from "./shared/schema";

export class UserManager {
  /**
   * 创建新用户
   */
  async createUser(data: InsertUser): Promise<User> {
    const db = await getDb();
    const validated = insertUserSchema.parse(data);
    const [user] = await db.insert(users).values(validated).returning();
    return user;
  }

  /**
   * 根据 ID 获取用户
   */
  async getUserById(id: string): Promise<User | null> {
    const db = await getDb();
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || null;
  }

  /**
   * 根据 email 获取用户
   */
  async getUserByEmail(email: string): Promise<User | null> {
    const db = await getDb();
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || null;
  }

  /**
   * 更新用户
   */
  async updateUser(id: string, data: UpdateUser): Promise<User | null> {
    const db = await getDb();
    const validated = updateUserSchema.parse(data);
    const [user] = await db
      .update(users)
      .set({ ...validated, updatedAt: new Date().toISOString() })
      .where(eq(users.id, id))
      .returning();
    return user || null;
  }

  /**
   * 获取或创建用户（简化登录流程）
   */
  async getOrCreateUser(name: string, email?: string): Promise<User> {
    const db = await getDb();

    // 如果有email，先尝试通过email查找
    if (email) {
      const existingUser = await this.getUserByEmail(email);
      if (existingUser) {
        return existingUser;
      }
    }

    // 创建新用户
    const newUser: InsertUser = {
      name,
      email: email || null,
    };

    return await this.createUser(newUser);
  }
}

export const userManager = new UserManager();
