import { NextRequest, NextResponse } from 'next/server';
import { S3Storage } from 'coze-coding-dev-sdk';
import sharp from 'sharp';

export const runtime = 'nodejs';
export const maxDuration = 120;

const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: '',
  secretKey: '',
  bucketName: process.env.COZE_BUCKET_NAME,
  region: 'cn-beijing',
});

export async function POST(request: NextRequest) {
  try {
    console.log('[test-compose-image] ========== 测试图片合成 ==========');
    const body = await request.json();
    const { sceneId = "test", imageList = [], prompt } = body;

    console.log('[test-compose-image] prompt:', prompt);
    console.log('[test-compose-image] imageList:', imageList.length, '张图片');

    // Coze API 配置
    const COZE_API_URL = process.env.COZE_IMAGE_API_URL || '';
    const COZE_TOKEN = process.env.COZE_IMAGE_API_TOKEN || '';

    if (!COZE_API_URL || !COZE_TOKEN) {
      return NextResponse.json(
        {
          success: false,
          message: '服务器配置错误：缺少环境变量 COZE_IMAGE_API_URL 或 COZE_IMAGE_API_TOKEN',
        },
        { status: 500 }
      );
    }

    // 将图片URL数组转换为Coze API期望的格式
    const imageObjectList = imageList.map((url: string, index: number) => ({
      image_name: `reference_${index}`,
      image_url: url,
    }));

    const requestBody = {
      image_list: imageObjectList,
      prompt: prompt || "A cozy cafe with warm lighting",
    };

    console.log('[test-compose-image] 调用Coze API...');
    const cozeResponse = await fetch(COZE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${COZE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('[test-compose-image] Coze API响应状态:', cozeResponse.status);

    if (!cozeResponse.ok) {
      const errorText = await cozeResponse.text();
      console.error('[test-compose-image] Coze API错误响应:', errorText);
      return NextResponse.json(
        {
          success: false,
          message: `Coze API调用失败: ${cozeResponse.status} - ${errorText}`,
        },
        { status: 500 }
      );
    }

    const cozeResult = await cozeResponse.json();
    console.log('[test-compose-image] Coze API响应数据:', JSON.stringify(cozeResult, null, 2));

    // 提取生成的图片URL
    const generatedImageUrl = cozeResult.generated_image_url || cozeResult.data || cozeResult.url || cozeResult.image;
    if (!generatedImageUrl) {
      console.error('[test-compose-image] Coze API响应中没有找到图片URL');
      return NextResponse.json(
        {
          success: false,
          message: 'Coze API响应中没有找到图片URL',
        },
        { status: 500 }
      );
    }

    console.log('[test-compose-image] ✅ 生成的图片URL:', generatedImageUrl);

    return NextResponse.json({
      success: true,
      data: {
        imageUrl: generatedImageUrl,
        cozeResponse: cozeResult,
      },
    });
  } catch (error) {
    console.error('[test-compose-image] 图片合成异常:', error);
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
