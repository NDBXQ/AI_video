import { NextRequest, NextResponse } from 'next/server';
import { generateReferenceImages, type GenerateImageRequest } from '@/features/video-creation/services/imageGenerationService';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * POST /api/video-creation/images/generate
 * 生成参考图并保存到对象存储与数据库
 * @param {NextRequest} request - Next.js 请求对象
 * @returns {Promise<NextResponse>} 接口响应
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<GenerateImageRequest>;
    const prompts = body.prompts;
    const storyboardId = body.storyboardId;
    const forceRegenerate = body.forceRegenerate ?? false;

    console.log('[images/generate] request', {
      storyboardId,
      promptCount: Array.isArray(prompts) ? prompts.length : -1,
      forceRegenerate,
    });

    if (!Array.isArray(prompts)) {
      return NextResponse.json({ success: false, message: 'prompts 必须是数组' }, { status: 400 });
    }
    if (prompts.length === 0) {
      return NextResponse.json({ success: false, message: 'prompts 不能为空' }, { status: 400 });
    }
    if (!storyboardId) {
      return NextResponse.json({ success: false, message: 'storyboardId 是必填参数' }, { status: 400 });
    }

    const result = await generateReferenceImages({
      prompts,
      storyboardId,
      storyId: body.storyId,
      forceRegenerate,
    });

    return NextResponse.json({
      success: true,
      data: {
        images: result.images,
        skipped: result.skipped,
        errors: result.errors,
        total: result.total,
        successCount: result.successCount,
        skippedCount: result.skippedCount,
      },
      message: result.message,
    });
  } catch (error) {
    console.error('[images/generate] failed:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return NextResponse.json({ success: false, message: `生成失败: ${errorMessage}` }, { status: 500 });
  }
}
