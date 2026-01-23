import { NextRequest, NextResponse } from 'next/server';
import { composeImage } from '@/features/video-creation/services/compositionService';

export const runtime = 'nodejs';
export const maxDuration = 120;

interface ComposeImageRequest {
  storyboardId: string; // 分镜ID（storyboardTextId）
}

/**
 * POST /api/video-creation/images/compose
 * 基于参考图和提示词生成新的合成图片
 * @param {NextRequest} request - Next.js 请求对象
 * @returns {Promise<NextResponse>} 接口响应
 */
export async function POST(request: NextRequest) {
  try {
    const body: ComposeImageRequest = await request.json();
    const { storyboardId } = body;

    if (!storyboardId) {
      return NextResponse.json(
        {
          success: false,
          message: 'storyboardId 是必填参数',
        },
        { status: 400 }
      );
    }

    const result = await composeImage(storyboardId);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[compose-image] 图片合成异常:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return NextResponse.json(
      {
        success: false,
        message: `图片合成失败: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}
