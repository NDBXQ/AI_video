import { NextRequest, NextResponse } from 'next/server';

const PROMPT_API_URL = 'https://jyyj7yy9p5.coze.site/run';
const PROMPT_API_TOKEN = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjI1NDgzMTMwLWQxYzAtNGZlNS05ZjJlLWRmNjU3OTFkMDJlNSJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbIktKQnBoRURUQlZEYk55QjM1aTg2Ykk4SkdRVVREUGVmIl0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzY3OTY1OTE2LCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NTkyNDU1Mzk1ODA5OTUxNzc4Iiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NTkzMzU1NzkwMjIwNTI1NjE5In0.bp0PZazNwFU-7qGkWG-scWxEQkzB9sTzGo6jxLo8-jOayiIPVE-nP5Me7JRdpE9VySfnN7-_t2q-k6IJ3yMLlGdX2hw-CGIL4ueJQIiLA_PdbyrJhven43CnISZSZddQgfRYkN2lIZNgoQA9M2t-6KBqJtZUlb2n3Kfx1uGEFM36rO4Z2oh-ZtzNLQmaNgDlB9Z4CTTnAgV6AVmqOVFT0hic6aSI4orbBXtYD9s_onJSRZQaTgfdxXi-rBPFntBX7EIL60WSv8tAKuNB8O2oVXgk4Eki5dF9d06HZrksXMi0F1zfyLOGCK1etnZXIvJUwmGz6FLZQrCPWAxn2Pizvg';

export const runtime = 'nodejs';

/**
 * POST /api/test/debug-prompt-generation
 * 调试提示词生成流程
 */
export async function POST(request: NextRequest) {
  console.log(`[debug-prompt] ========== 开始调试提示词生成 ==========`);

  try {
    const body = await request.json();
    const { sceneId, scriptContent } = body;

    console.log(`[debug-prompt] sceneId: ${sceneId}`);
    console.log(`[debug-prompt] scriptContent type: ${typeof scriptContent}`);
    console.log(`[debug-prompt] scriptContent value:`, typeof scriptContent === 'string' ? scriptContent.substring(0, 500) : scriptContent);

    // 解析 scriptContent
    const scriptJson = typeof scriptContent === 'string' ? JSON.parse(scriptContent) : scriptContent;
    console.log(`[debug-prompt] 解析后的 scriptJson keys:`, Object.keys(scriptJson));
    console.log(`[debug-prompt] 解析后的 scriptJson完整结构:`, JSON.stringify(scriptJson, null, 2));

    // Coze分镜脚本API现在直接返回正确格式：
    // { video_script: { shot_info, shot_content, video_content } }
    // 直接传递即可，无需转换
    const cozeRequestBody = {
      script_json: scriptJson,
    };

    console.log(`[debug-prompt] Coze API 请求体:`, JSON.stringify(cozeRequestBody, null, 2));
    console.log(`[debug-prompt] script_json结构验证:`, {
      hasVideoScript: !!cozeRequestBody.script_json.video_script,
      hasShotInfo: !!cozeRequestBody.script_json.video_script?.shot_info,
      hasShotContent: !!cozeRequestBody.script_json.video_script?.shot_content,
      hasVideoContent: !!cozeRequestBody.script_json.video_script?.video_content,
    });

    // 调用 Coze API
    const response = await fetch(PROMPT_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PROMPT_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cozeRequestBody),
    });

    console.log(`[debug-prompt] Coze API 响应状态: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[debug-prompt] Coze API 调用失败:`, errorText);
      return NextResponse.json({
        success: false,
        message: `Coze API 调用失败: ${response.status}`,
        error: errorText,
      });
    }

    const result = await response.json();
    console.log(`[debug-prompt] Coze API 返回结果:`, JSON.stringify(result, null, 2));

    return NextResponse.json({
      success: true,
      message: '调试成功',
      debugData: {
        sceneId,
        originalScriptJson: scriptJson,
        cozeRequestBody,
        cozeResponse: result,
      },
    });
  } catch (error) {
    console.error(`[debug-prompt] 错误:`, error);
    return NextResponse.json({
      success: false,
      message: `调试失败: ${error instanceof Error ? error.message : '未知错误'}`,
      error: String(error),
    });
  }
}
