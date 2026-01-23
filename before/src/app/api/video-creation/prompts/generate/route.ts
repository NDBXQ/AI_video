import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60; // 60秒超时

// 提示词生成API配置
const PROMPT_API_URL = 'https://jyyj7yy9p5.coze.site/run';
const PROMPT_API_TOKEN = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjI1NDgzMTMwLWQxYzAtNGZlNS05ZjJlLWRmNjU3OTFkMDJlNSJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbIktKQnBoRURUQlZEYk55QjM1aTg2Ykk4SkdRVVREUGVmIl0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzY3OTY1OTE2LCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NTkyNDU1Mzk1ODA5OTUxNzc4Iiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NTkzMzU1NzkwMjIwNTI1NjE5In0.bp0PZazNwFU-7qGkWG-scWxEQkzB9sTzGo6jxLo8-jOayiIPVE-nP5Me7JRdpE9VySfnN7-_t2q-k6IJ3yMLlGdX2hw-CGIL4ueJQIiLA_PdbyrJhven43CnISZSZddQgfRYkN2lIZNgoQA9M2t-6KBqJtZUlb2n3Kfx1uGEFM36rO4Z2oh-ZtzNLQmaNgDlB9Z4CTTnAgV6AVmqOVFT0hic6aSI4orbBXtYD9s_onJSRZQaTgfdxXi-rBPFntBX7EIL60WSv8tAKuNB8O2oVXgk4Eki5dF9d06HZrksXMi0F1zfyLOGCK1etnZXIvJUwmGz6FLZQrCPWAxn2Pizvg';

interface GeneratePromptsRequest {
  script_json: any; // 分镜脚本JSON数据
}

interface GeneratePromptsResponse {
  success: boolean;
  message?: string;
  data?: any;
}

/**
 * POST /api/video-creation/prompts/generate
 * 调用提示词生成API
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[generate-prompts] ========== 收到生成提示词请求 ==========');
    const body: GeneratePromptsRequest = await request.json();
    const { script_json } = body;

    console.log('[generate-prompts] 请求参数:');
    console.log('[generate-prompts] - script_json:', JSON.stringify(script_json, null, 2));

    if (!script_json) {
      return NextResponse.json({
        success: false,
        message: '缺少必要参数：script_json',
      }, { status: 400 });
    }

    console.log('[generate-prompts] 开始调用提示词生成API...');
    console.log('[generate-prompts] API URL:', PROMPT_API_URL);

    const startTime = Date.now();

    // 调用提示词生成API
    const response = await fetch(PROMPT_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PROMPT_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        script_json,
      ),
    });

    const duration = Date.now() - startTime;
    console.log('[generate-prompts] API请求耗时:', duration, 'ms');
    console.log('[generate-prompts] API响应状态:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generate-prompts] API调用失败:', response.status, errorText);
      return NextResponse.json({
        success: false,
        message: `提示词生成失败: ${response.status} - ${errorText}`,
      }, { status: response.status });
    }

    const result = await response.json();
    console.log('[generate-prompts] API响应数据:', JSON.stringify(result, null, 2));

    console.log('[generate-prompts] ========== 生成提示词成功 ==========');

    return NextResponse.json({
      success: true,
      message: '提示词生成成功',
      data: result,
    });
  } catch (error) {
    console.error('[generate-prompts] 生成提示词异常:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    console.error('[generate-prompts] 异常详情:', errorMessage);

    return NextResponse.json({
      success: false,
      message: `生成提示词失败: ${errorMessage}`,
    }, { status: 500 });
  }
}
