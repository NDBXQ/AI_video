import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 300; // 300秒超时（5分钟）

interface CozeScriptRequest {
  raw_script: string;
  demand: string;
}

interface CozeScriptResponse {
  success: boolean;
  data?: any;
  message?: string;
}

/**
 * POST /api/coze/generate-script
 * 调用 Coze 接口生成分镜脚本
 */
export async function POST(request: NextRequest) {
  try {
    const body: CozeScriptRequest = await request.json();

    const { raw_script, demand } = body;

    // 验证必填参数
    if (!raw_script || typeof raw_script !== 'string') {
      return NextResponse.json(
        {
          success: false,
          message: '缺少必填参数：raw_script',
        },
        { status: 400 }
      );
    }

    if (!demand || typeof demand !== 'string') {
      return NextResponse.json(
        {
          success: false,
          message: '缺少必填参数：demand',
        },
        { status: 400 }
      );
    }

    // Coze API 配置
    const COZE_API_URL = process.env.COZE_SCRIPT_API_URL || '';
    const COZE_TOKEN = process.env.COZE_SCRIPT_API_TOKEN || '';

    if (!COZE_API_URL || !COZE_TOKEN) {
      console.error('[generate-script] 缺少环境变量 COZE_SCRIPT_API_URL 或 COZE_SCRIPT_API_TOKEN');
      return NextResponse.json(
        {
          success: false,
          message: '服务器配置错误：缺少API配置',
        },
        { status: 500 }
      );
    }

    // 调用 Coze API
    console.log('[generate-script] 开始调用Coze API');
    console.log('[generate-script] - raw_script长度:', raw_script.length);
    console.log('[generate-script] - demand长度:', demand.length);
    console.log('[generate-script] - Coze API URL:', COZE_API_URL);
    console.log('[generate-script] - raw_script前100字符:', raw_script.substring(0, 100));

    let response;
    try {
      response = await fetch(COZE_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${COZE_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          raw_script: raw_script.trim(),
          demand: demand.trim(),
        }),
      });
    } catch (fetchError) {
      console.error('[generate-script] Coze API 网络请求失败:', fetchError);
      console.error('[generate-script] fetchError类型:', typeof fetchError);
      console.error('[generate-script] fetchError信息:', fetchError instanceof Error ? {
        message: fetchError.message,
        stack: fetchError.stack,
        name: fetchError.name
      } : fetchError);
      return NextResponse.json(
        {
          success: false,
          message: `Coze API 网络请求失败: ${fetchError instanceof Error ? fetchError.message : '未知错误'}`,
        },
        { status: 500 }
      );
    }

    console.log('[generate-script] Coze API响应状态:', response.status, response.statusText);

    if (!response.ok) {
      let errorText = '';
      try {
        errorText = await response.text();
      } catch (e) {
        errorText = '无法读取错误响应';
      }
      console.error('[generate-script] Coze API 调用失败:', response.status, errorText);

      // 尝试解析错误详情，提供更友好的提示
      let userMessage = `Coze API 调用失败: ${response.status} ${response.statusText}`;
      let errorDetails = errorText;

      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.message) {
          userMessage = errorJson.message;
          // 如果错误信息包含JSON解析问题，添加提示
          if (errorJson.message.includes('Extra data') || errorJson.message.includes('无法解析模型返回的JSON')) {
            userMessage = '模型返回的数据格式异常，请重试';
            errorDetails = '模型返回了多个JSON对象而不是单个对象，这可能是由于模型理解偏差导致的。建议重试，如果问题持续，请联系管理员。';
          }
        }
        if (errorJson.details) {
          errorDetails = errorJson.details;
        }
      } catch (e) {
        // 无法解析为JSON，保持原样
      }

      return NextResponse.json(
        {
          success: false,
          message: userMessage,
          details: errorDetails,
        },
        { status: response.status }
      );
    }

    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error('[generate-script] 解析JSON失败:', parseError);
      return NextResponse.json(
        {
          success: false,
          message: 'Coze API 返回数据格式错误',
        },
        { status: 500 }
      );
    }

    console.log('[generate-script] Coze API返回数据 success:', data.success, 'keys:', Object.keys(data));
    console.log('[generate-script] Coze API完整返回数据:', JSON.stringify(data, null, 2));
    if (data.video_script) {
      console.log('[generate-script] video_script keys:', Object.keys(data.video_script));
      console.log('[generate-script] video_script结构:', JSON.stringify(data.video_script, null, 2));
    }

    // 检查返回数据是否包含错误
    if (data.video_script && data.video_script.error) {
      console.warn('[generate-script] Coze API 返回业务错误:', data.video_script.error);
      // 业务错误仍然返回成功，让前端处理
      return NextResponse.json({
        success: true,
        data: data,
        message: '分镜脚本生成成功（但包含警告）',
      });
    }

    // 检查data是否包含完整的video_script
    if (!data.video_script) {
      console.error('[generate-script] Coze API 返回数据缺少 video_script 字段');
      return NextResponse.json(
        {
          success: false,
          message: 'Coze API 返回数据格式错误：缺少 video_script 字段',
          details: JSON.stringify(data),
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data,
      message: '分镜脚本生成成功',
    });
  } catch (error) {
    console.error('生成脚本失败:', error);

    const errorMessage =
      error instanceof Error ? error.message : '未知错误';

    return NextResponse.json(
      {
        success: false,
        message: `生成失败: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}
