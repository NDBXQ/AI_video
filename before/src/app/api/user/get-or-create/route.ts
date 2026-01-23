import { NextRequest, NextResponse } from 'next/server';
import { userManager } from '@/storage/database/userManager';

export const runtime = 'nodejs';

/**
 * POST /api/user/get-or-create
 * 获取或创建用户（简化登录流程）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email } = body;

    // 验证必填参数
    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        {
          success: false,
          message: '缺少必填参数：name',
        },
        { status: 400 }
      );
    }

    const user = await userManager.getOrCreateUser(name, email);

    return NextResponse.json({
      success: true,
      data: user,
      message: '用户获取或创建成功',
    });
  } catch (error) {
    console.error('获取或创建用户失败:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return NextResponse.json(
      {
        success: false,
        message: `操作失败: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}
