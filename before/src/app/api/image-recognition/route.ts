import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, Message } from 'coze-coding-dev-sdk';

interface RecognitionRequest {
  imageData?: string; // Base64 图片数据
  imageUrl?: string;  // 图片 URL
  prompt?: string;    // 自定义提示词
}

interface RecognitionResponse {
  success: boolean;
  result?: string;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<RecognitionResponse>> {
  try {
    const body: RecognitionRequest = await request.json();

    const { imageData, imageUrl, prompt } = body;

    // 验证输入
    if (!imageData && !imageUrl) {
      return NextResponse.json(
        { success: false, error: '请提供图片数据（base64）或图片URL' },
        { status: 400 }
      );
    }

    // 准备图片 URL
    let imageSource = imageUrl;
    if (imageData) {
      // 如果提供了 base64 数据，确保格式正确
      if (!imageData.startsWith('data:image/')) {
        imageSource = `data:image/jpeg;base64,${imageData}`;
      } else {
        imageSource = imageData;
      }
    }

    // 构建系统提示词
    const systemPrompt = '你是一个专业的图片识别助手。请详细描述图片中的内容，包括主要物体、场景、文字、颜色、布局等细节。';

    // 构建用户消息
    const userMessage = prompt || '请详细描述这张图片的内容';

    // 初始化 LLM 客户端
    const config = new Config();
    const client = new LLMClient(config);

    // 构建消息
    const messages = [
      {
        role: 'system' as const,
        content: systemPrompt,
      },
      {
        role: 'user' as const,
        content: [
          {
            type: 'text' as const,
            text: userMessage,
          },
          {
            type: 'image_url' as const,
            image_url: {
              url: imageSource!,
              detail: 'high' as const,
            },
          },
        ],
      },
    ];

    // 调用视觉模型
    const response = await client.invoke(
      messages as Message[],
      {
        model: 'doubao-seed-1-6-vision-250815',
        temperature: 0.7,
      }
    );

    // 返回识别结果
    return NextResponse.json({
      success: true,
      result: response.content,
    });

  } catch (error) {
    console.error('图片识别错误:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '图片识别失败，请稍后重试',
      },
      { status: 500 }
    );
  }
}
