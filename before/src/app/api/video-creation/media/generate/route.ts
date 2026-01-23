import { NextRequest, NextResponse } from 'next/server';
import { MediaType } from '@/features/video-creation/domain/mediaTypes';

export const runtime = 'nodejs';

/**
 * POST /api/video-creation/media/generate
 * 生成媒体素材（图片/视频/音频）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, prompt, style, quantity = 1 } = body;

    // 验证参数
    if (!type || !['image', 'video', 'audio'].includes(type)) {
      return NextResponse.json(
        {
          success: false,
          message: '无效的媒体类型',
        },
        { status: 400 }
      );
    }

    if (!prompt) {
      return NextResponse.json(
        {
          success: false,
          message: '缺少生成提示词',
        },
        { status: 400 }
      );
    }

    console.log('[generate-media] 收到生成请求:', { type, prompt, style, quantity });

    // TODO: 集成实际的AI生成服务
    // - 图片：调用豆包生图大模型
    // - 音频：调用豆包语音大模型
    // - 视频：未来可以集成视频生成模型

    // 模拟生成延迟
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 返回模拟结果
    const results = Array.from({ length: quantity }, (_, index) => ({
      id: `generated-${Date.now()}-${index}`,
      type,
      url: `https://example.com/generated/${index}.jpg`,
      thumbnail: `https://example.com/generated/${index}_thumb.jpg`,
      title: `AI生成的${type === 'image' ? '图片' : type === 'video' ? '视频' : '音频'} ${index + 1}`,
      duration: type !== 'image' ? 15 : undefined,
      category: style || '默认',
      tags: ['AI生成', style || '默认'],
      source: 'generate' as const,
      generatedFrom: prompt.substring(0, 50) + '...',
      liked: false,
      createdAt: new Date().toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: results,
      message: `成功生成${results.length}个${type === 'image' ? '图片' : type === 'video' ? '视频' : '音频'}`,
    });
  } catch (error) {
    console.error('生成媒体失败:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '生成失败',
      },
      { status: 500 }
    );
  }
}
