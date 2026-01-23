import { NextRequest, NextResponse } from 'next/server';

// 从scripts/create中复制异步生成逻辑
const PROMPT_API_URL = 'https://jyyj7yy9p5.coze.site/run';
const PROMPT_API_TOKEN = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjI1NDgzMTMwLWQxYzAtNGZlNS05ZjJlLWRmNjU3OTFkMDJlNSJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbIktKQnBoRURUQlZEYk55QjM1aTg2Ykk4SkdRVVREUGVmIl0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzY3OTY1OTE2LCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NTkyNDU1Mzk1ODA5OTUxNzc4Iiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NTkzMzU1NzkwMjIwNTI1NjE5In0.bp0PZazNwFU-7qGkWG-scWxEQkzB9sTzGo6jxLo8-jOayiIPVE-nP5Me7JRdpE9VySfnN7-_t2q-k6IJ3yMLlGdX2hw-CGIL4ueJQIiLA_PdbyrJhven43CnISZSZddQgfRYkN2lIZNgoQA9M2t-6KBqJtZUlb2n3Kfx1uGEFM36rO4Z2oh-ZtzNLQmaNgDlB9Z4CTTnAgV6AVmqOVFT0hic6aSI4orbBXtYD9s_onJSRZQaTgfdxXi-rBPFntBX7EIL60WSv8tAKuNB8O2oVXgk4Eki5dF9d06HZrksXMi0F1zfyLOGCK1etnZXIvJUwmGz6FLZQrCPWAxn2Pizvg';

/**
 * 测试异步生成提示词
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sceneId, scriptContent } = body;

    console.log('[test-async-prompt] 收到测试请求:', { sceneId });

    if (!sceneId || !scriptContent) {
      return NextResponse.json({
        success: false,
        message: '缺少必要参数: sceneId 或 scriptContent',
      }, { status: 400 });
    }

    // 解析scriptContent
    const scriptJson = typeof scriptContent === 'string' ? JSON.parse(scriptContent) : scriptContent;

    console.log('[test-async-prompt] 开始调用提示词API...');
    const startTime = Date.now();

    // 调用提示词生成API
    const response = await fetch(PROMPT_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PROMPT_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        script_json: scriptJson,
      }),
    });

    const duration = Date.now() - startTime;
    console.log(`[test-async-prompt] API调用耗时: ${duration}ms`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[test-async-prompt] API调用失败:', response.status, errorText);
      return NextResponse.json({
        success: false,
        message: `API调用失败: ${response.status} - ${errorText}`,
      }, { status: 500 });
    }

    const result = await response.json();
    console.log('[test-async-prompt] API响应:', JSON.stringify(result, null, 2));

    return NextResponse.json({
      success: true,
      message: '提示词生成成功',
      data: result,
      duration,
    });
  } catch (error) {
    console.error('[test-async-prompt] 异常:', error);
    return NextResponse.json({
      success: false,
      message: `测试失败: ${error instanceof Error ? error.message : '未知错误'}`,
    }, { status: 500 });
  }
}
