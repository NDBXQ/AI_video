import { NextRequest, NextResponse } from 'next/server';
import { generateVideo, ServiceError } from '@/server/services/video-creation/video-generation/generateVideo';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5分钟超时（视频生成可能需要更长时间）

interface GenerateVideoRequest {
  storyboardId: string; // 分镜ID（storyboardTextId）
  mode?: '首帧' | '尾帧'; // 生成模式，未传则读取 prompts.image_prompt_type
  generateAudio?: boolean;
  watermark?: boolean;
  forceRegenerate?: boolean;
}

/**
 * POST /api/video-creation/videos/generate
 * 基于提示词和参考图生成视频
 */
export async function POST(request: NextRequest) {
  try {
    const body: GenerateVideoRequest = await request.json();
    const { storyboardId } = body;

    // 验证必填参数
    if (!storyboardId) {
      return NextResponse.json(
        {
          success: false,
          message: 'storyboardId 是必填参数',
        },
        { status: 400 }
      );
    }
    const video = await generateVideo({
      storyboardId,
      mode: body.mode,
      generateAudio: body.generateAudio,
      watermark: body.watermark,
      forceRegenerate: body.forceRegenerate,
    });
    return NextResponse.json({
      success: true,
      data: {
        video: {
          id: video.id,
          name: video.name,
          url: video.url,
          mode: video.mode,
        },
      },
    });
  } catch (error) {
    if (error instanceof ServiceError) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
        },
        { status: error.status }
      );
    }
    console.error('[generate-video] 视频生成异常:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return NextResponse.json(
      {
        success: false,
        message: `视频生成失败: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}
