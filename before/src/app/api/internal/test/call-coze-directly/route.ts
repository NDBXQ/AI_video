import { NextRequest, NextResponse } from 'next/server';

const PROMPT_API_URL = process.env.COZE_PROMPT_API_URL || '';
const PROMPT_API_TOKEN = process.env.COZE_PROMPT_API_TOKEN || '';

export const runtime = 'nodejs';

/**
 * POST /api/test/call-coze-directly
 * 直接调用Coze API进行测试
 */
export async function POST(request: NextRequest) {
  console.log(`[test-call-coze-directly] ========== 开始测试直接调用Coze API ==========`);

  if (!PROMPT_API_URL || !PROMPT_API_TOKEN) {
    return NextResponse.json(
      {
        success: false,
        message: '服务器配置错误：缺少环境变量 COZE_PROMPT_API_URL 或 COZE_PROMPT_API_TOKEN',
      },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();

    console.log(`[test-call-coze-directly] 接收到的请求体:`, JSON.stringify(body, null, 2));

    // 直接转发请求到Coze API
    console.log(`[test-call-coze-directly] 转发请求到: ${PROMPT_API_URL}`);

    const response = await fetch(PROMPT_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PROMPT_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    console.log(`[test-call-coze-directly] Coze API响应状态: ${response.status} ${response.statusText}`);
    console.log(`[test-call-coze-directly] Coze API响应Headers:`, Object.fromEntries(response.headers.entries()));

    const responseText = await response.text();
    console.log(`[test-call-coze-directly] Coze API原始响应:`, responseText);

    // 尝试解析JSON
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      console.error(`[test-call-coze-directly] JSON解析失败:`, e);
      responseData = {
        rawResponse: responseText,
        parseError: e instanceof Error ? e.message : String(e)
      };
    }

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      data: responseData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`[test-call-coze-directly] ========== 测试失败 ==========`);
    console.error(`[test-call-coze-directly] 错误详情:`, error);
    console.error(`[test-call-coze-directly] ========== 错误结束 ==========`);

    const errorMessage =
      error instanceof Error ? error.message : '未知错误';

    return NextResponse.json(
      {
        success: false,
        message: `操作失败: ${errorMessage}`,
        error: String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
