import { NextRequest, NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';

export const runtime = 'nodejs';

/**
 * POST /api/database/migrate-users-stories
 * 执行数据库迁移，创建users和stories表
 */
export async function POST(request: NextRequest) {
  try {
    const db = await getDb();

    // 检查users表是否存在
    const usersExists = await db.execute(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'users'
      );
    `);

    // 检查stories表是否存在
    const storiesExists = await db.execute(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'stories'
      );
    `);

    // 创建users表
    if (!usersExists.rows[0].exists) {
      await db.execute(`
        CREATE TABLE users (
          id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(128) NOT NULL,
          email VARCHAR(255),
          avatar_url TEXT,
          is_active BOOLEAN DEFAULT true NOT NULL,
          metadata TEXT,
          current_story_id VARCHAR(36),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE
        );
      `);

      // 创建索引
      await db.execute(`
        CREATE INDEX users_email_idx ON users USING btree (email ASC NULLS LAST);
      `);

      // 创建唯一约束
      await db.execute(`
        ALTER TABLE users
        ADD CONSTRAINT users_email_unique UNIQUE (email);
      `);

      console.log('✅ users 表创建成功');
    } else {
      console.log('ℹ️  users 表已存在，跳过创建');
    }

    // 创建stories表
    if (!storiesExists.rows[0].exists) {
      await db.execute(`
        CREATE TABLE stories (
          id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id VARCHAR(36) NOT NULL,
          title VARCHAR(255),
          story_type VARCHAR(20),
          story_text TEXT NOT NULL,
          generated_text TEXT,
          run_id TEXT,
          status VARCHAR(20) DEFAULT 'draft' NOT NULL,
          progress_stage VARCHAR(20) DEFAULT 'outline' NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE
        );
      `);

      // 创建索引
      await db.execute(`
        CREATE INDEX stories_user_id_idx ON stories USING btree (user_id ASC NULLS LAST);
      `);

      // 添加外键约束
      try {
        await db.execute(`
          ALTER TABLE stories
          ADD CONSTRAINT stories_user_id_fkey
          FOREIGN KEY (user_id)
          REFERENCES users(id)
          ON DELETE CASCADE;
        `);
        console.log('✅ stories 表外键约束创建成功');
      } catch (fkError: any) {
        console.warn('添加外键约束失败（可能已存在）:', fkError.message);
      }

      console.log('✅ stories 表创建成功');
    } else {
      console.log('ℹ️  stories 表已存在，跳过创建');
    }

    // 添加 users 表的外键约束（如果还没有）
    try {
      await db.execute(`
        ALTER TABLE users
        ADD CONSTRAINT users_current_story_id_fkey
        FOREIGN KEY (current_story_id)
        REFERENCES stories(id)
        ON DELETE SET NULL;
      `);
      console.log('✅ users 表外键约束创建成功');
    } catch (fkError: any) {
      console.warn('添加 users 外键约束失败（可能已存在）:', fkError.message);
    }

    return NextResponse.json({
      success: true,
      message: '数据库迁移成功，已创建users和stories表',
    });
  } catch (error) {
    console.error('数据库迁移失败:', error);

    const errorMessage =
      error instanceof Error ? error.message : '未知错误';

    return NextResponse.json(
      {
        success: false,
        message: `迁移失败: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}
