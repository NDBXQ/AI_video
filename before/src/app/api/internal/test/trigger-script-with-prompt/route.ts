import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/test/trigger-script-with-prompt
 * 测试创建脚本并触发提示词生成
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[test-trigger] ========== 开始测试触发脚本创建和提示词生成 ==========');

    const body = await request.json();
    const { storyboardTextId, sequence, scriptContent, imageUrl } = body;

    console.log('[test-trigger] 请求参数:', {
      storyboardTextId,
      sequence,
      hasScriptContent: !!scriptContent,
      hasImageUrl: !!imageUrl
    });

    // 调用创建脚本API
    console.log('[test-trigger] 准备调用 /api/video-creation/scripts/create');
    const response = await fetch('http://localhost:5000/api/video-creation/scripts/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        storyboardTextId,
        sequence,
        scriptContent,
        imageUrl,
      }),
    });

    console.log('[test-trigger] 创建脚本响应状态:', response.status);

    const result = await response.json();
    console.log('[test-trigger] 创建脚本响应:', JSON.stringify(result, null, 2));

    console.log('[test-trigger] ========== 测试完成 ==========');

    return NextResponse.json({
      success: true,
      message: '测试成功，请查看后端控制台日志',
      data: result,
    });
  } catch (error) {
    console.error('[test-trigger] 测试失败:', error);
    return NextResponse.json(
      {
        success: false,
        message: `测试失败: ${error instanceof Error ? error.message : '未知错误'}`,
      },
      { status: 500 }
    );
  }
}
