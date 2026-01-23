import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5分钟超时（视频生成可能需要更长时间）

const COZE_API_URL = process.env.COZE_VIDEO_API_URL || '';
const COZE_TOKEN = process.env.COZE_VIDEO_API_TOKEN || '';

interface GenerateVideoRequest {
  prompt: string;
  mode?: '首帧' | '尾帧';
  imageUrl: string;
  sceneId?: string;
}

interface CozeVideoResponse {
  data?: string;
  url?: string;
  video_url?: string;
  generated_video_url?: string;
  [key: string]: any;
}

/**
 * POST /api/test/generate-video
 * 测试视频生成API
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[test-generate-video] ========== 测试视频生成 ==========');
    
    if (!COZE_API_URL || !COZE_TOKEN) {
      return NextResponse.json(
        {
          success: false,
          message: '服务器配置错误：缺少环境变量 COZE_VIDEO_API_URL 或 COZE_VIDEO_API_TOKEN',
        },
        { status: 500 }
      );
    }

    const body: GenerateVideoRequest = await request.json();
    const { prompt, mode = '首帧', imageUrl, sceneId = 'test' } = body;

    console.log('[test-generate-video] prompt:', prompt);
    console.log('[test-generate-video] mode:', mode);
    console.log('[test-generate-video] imageUrl:', imageUrl?.substring(0, 80) + '...');

    // 验证必填参数
    if (!prompt) {
      return NextResponse.json(
        {
          success: false,
          message: 'prompt 是必填参数',
        },
        { status: 400 }
      );
    }

    if (!imageUrl) {
      return NextResponse.json(
        {
          success: false,
          message: 'imageUrl 是必填参数',
        },
        { status: 400 }
      );
    }

    // 构建Coze API请求体
    const requestBody = {
      prompt: prompt,
      mode: mode,
      image: {
        url: imageUrl,
        file_type: 'image',
      },
    };

    console.log('[test-generate-video] 调用Coze API...');
    console.log('[test-generate-video] 请求体:', JSON.stringify(requestBody, null, 2));

    const cozeResponse = await fetch(COZE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${COZE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('[test-generate-video] Coze API响应状态:', cozeResponse.status);

    if (!cozeResponse.ok) {
      const errorText = await cozeResponse.text();
      console.error('[test-generate-video] Coze API错误响应:', errorText);
      return NextResponse.json(
        {
          success: false,
          message: `Coze API调用失败: ${cozeResponse.status} - ${errorText}`,
        },
        { status: 500 }
      );
    }

    const cozeResult: CozeVideoResponse = await cozeResponse.json();
    console.log('[test-generate-video] Coze API响应数据:', JSON.stringify(cozeResult, null, 2));

    // 提取生成的视频URL
    const generatedVideoUrl =
      cozeResult.generated_video_url ||
      cozeResult.video_url ||
      cozeResult.data ||
      cozeResult.url;

    if (!generatedVideoUrl) {
      console.error('[test-generate-video] Coze API响应中没有找到视频URL');
      return NextResponse.json(
        {
          success: false,
          message: 'Coze API响应中没有找到视频URL',
        },
        { status: 500 }
      );
    }

    console.log('[test-generate-video] ✅ 生成的视频URL:', generatedVideoUrl);

    return NextResponse.json({
      success: true,
      data: {
        videoUrl: generatedVideoUrl,
        cozeResponse: cozeResult,
      },
    });
  } catch (error) {
    console.error('[test-generate-video] 视频生成异常:', error);
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
