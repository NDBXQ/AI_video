import { NextRequest, NextResponse } from 'next/server';
import { promptManager } from '@/storage/database/promptManager';

const PROMPT_API_URL = process.env.COZE_PROMPT_API_URL || '';
const PROMPT_API_TOKEN = process.env.COZE_PROMPT_API_TOKEN || '';

/**
 * 将数据库存储的对象格式转换为 Coze API 期望的数组格式
 * 输入格式：{ video_script: { shot: {...}, shot_content: {...}, video_content: {...} } }
 * 输出格式：{ video_script: { shot_info: [...], shot_content: [...], video_content: [...] } }
 */
function convertToCozeFormat(data: any): any {
  const result: any = {
    video_script: {}
  };

  // 提取 video_script 内部内容
  const videoScript = data.video_script || data;
  console.log(`[convertToCozeFormat] 提取的 videoScript:`, JSON.stringify(videoScript, null, 2));

  // 转换 shot -> shot_info (对象转数组)
  if (videoScript.shot) {
    result.video_script.shot_info = [videoScript.shot];
  } else if (videoScript.shot_info && Array.isArray(videoScript.shot_info)) {
    // 如果已经是数组格式，直接使用
    result.video_script.shot_info = videoScript.shot_info;
  }

  // 转换 shot_content (对象转数组)
  if (videoScript.shot_content) {
    result.video_script.shot_content = [videoScript.shot_content];
  } else if (videoScript.shot_content && Array.isArray(videoScript.shot_content)) {
    // 如果已经是数组格式，直接使用
    result.video_script.shot_content = videoScript.shot_content;
  }

  // 转换 video_content (对象转数组)
  if (videoScript.video_content) {
    result.video_script.video_content = [videoScript.video_content];
  } else if (videoScript.video_content && Array.isArray(videoScript.video_content)) {
    // 如果已经是数组格式，直接使用
    result.video_script.video_content = videoScript.video_content;
  }

  console.log(`[convertToCozeFormat] 原始数据:`, JSON.stringify(data, null, 2));
  console.log(`[convertToCozeFormat] 转换后数据:`, JSON.stringify(result, null, 2));

  return result;
}

export const runtime = 'nodejs';

/**
 * POST /api/test/generate-prompt-only
 * 测试提示词生成功能（不依赖外键约束）
 */
export async function POST(request: NextRequest) {
  console.log(`[test-generate-prompt-only] ========== 开始测试提示词生成 ==========`);

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
    const { sceneId, scriptJson, apiParamName = 'script_json', useDirectData = false } = body;

    console.log(`[test-generate-prompt-only] 请求参数:`, {
      sceneId,
      hasScriptJson: !!scriptJson,
      scriptJsonType: typeof scriptJson,
      apiParamName,
      useDirectData
    });

    // 验证必填字段
    if (!sceneId) {
      return NextResponse.json(
        {
          success: false,
          message: 'sceneId 是必填字段',
        },
        { status: 400 }
      );
    }

    if (!scriptJson) {
      return NextResponse.json(
        {
          success: false,
          message: 'scriptJson 是必填字段',
        },
        { status: 400 }
      );
    }

    // 解析scriptJson
    let parsedScriptJson;
    try {
      parsedScriptJson = typeof scriptJson === 'string' ? JSON.parse(scriptJson) : scriptJson;
      console.log(`[test-generate-prompt-only] 解析后的脚本JSON:`, JSON.stringify(parsedScriptJson, null, 2));
    } catch (parseError) {
      console.error(`[test-generate-prompt-only] JSON解析失败:`, parseError);
      return NextResponse.json(
        {
          success: false,
          message: 'scriptJson必须是有效的JSON格式',
        },
        { status: 400 }
      );
    }

    // 调用提示词生成API
    console.log(`[test-generate-prompt-only] 正在调用提示词API: ${PROMPT_API_URL}`);

    // 将数据转换为 Coze API 期望的格式
    const cozeFormatData = convertToCozeFormat(parsedScriptJson);

    const cozeRequestBody = {
      script_json: cozeFormatData,
    };

    console.log(`[test-generate-prompt-only] 完整Coze API请求体:`, JSON.stringify(cozeRequestBody, null, 2));
    console.log(`[test-generate-prompt-only] script_json结构验证:`, {
      hasVideoScript: !!cozeRequestBody.script_json.video_script,
      hasShotInfo: !!cozeRequestBody.script_json.video_script?.shot_info,
      hasShotContent: !!cozeRequestBody.script_json.video_script?.shot_content,
      hasVideoContent: !!cozeRequestBody.script_json.video_script?.video_content,
      shotInfoIsArray: Array.isArray(cozeRequestBody.script_json.video_script?.shot_info),
      shotContentIsArray: Array.isArray(cozeRequestBody.script_json.video_script?.shot_content),
      videoContentIsArray: Array.isArray(cozeRequestBody.script_json.video_script?.video_content),
    });

    const response = await fetch(PROMPT_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PROMPT_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cozeRequestBody),
    });

    console.log(`[test-generate-prompt-only] API响应状态: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[test-generate-prompt-only] API调用失败: ${response.status} - ${errorText}`);
      return NextResponse.json(
        {
          success: false,
          message: `API调用失败: ${response.status} - ${errorText}`,
        },
        { status: 500 }
      );
    }

    const result = await response.json();
    console.log(`[test-generate-prompt-only] 提示词生成成功，结果:`, JSON.stringify(result, null, 2));

    // 检查返回数据的结构
    console.log(`[test-generate-prompt-only] 检查返回数据结构...`);
    console.log(`[test-generate-prompt-only] result.video_prompt:`, result.video_prompt);
    console.log(`[test-generate-prompt-only] result.image_prompt_type:`, result.image_prompt_type);
    console.log(`[test-generate-prompt-only] result.image_prompt:`, result.image_prompt);
    console.log(`[test-generate-prompt-only] result.run_id:`, result.run_id);

    // 安全访问字段
    const videoPrompt = result.video_prompt || null;
    const imagePromptType = result.image_prompt_type || null;
    const imagePrompt = result.image_prompt || null;
    const runId = result.run_id || null;

    console.log(`[test-generate-prompt-only] 提取的字段:`, {
      videoPrompt,
      imagePromptType,
      imagePrompt,
      runId
    });

    // 保存到数据库
    console.log(`[test-generate-prompt-only] 正在保存到数据库...`);
    const savedPrompt = await promptManager.createPrompt({
      storyboardId: sceneId,
      videoPrompt: videoPrompt,
      imagePromptType: imagePromptType,
      imagePrompt: imagePrompt,
      runId: runId,
      scriptJson: JSON.stringify(parsedScriptJson),
    });

    console.log(`[test-generate-prompt-only] 提示词保存成功，ID: ${savedPrompt.id}`);
    console.log(`[test-generate-prompt-only] ========== 测试完成 ==========`);

    return NextResponse.json({
      success: true,
      message: '提示词生成并保存成功',
      data: {
        promptId: savedPrompt.id,
        videoPrompt: savedPrompt.videoPrompt,
        imagePrompt: savedPrompt.imagePrompt,
        runId: savedPrompt.runId,
      },
    });
  } catch (error) {
    console.error(`[test-generate-prompt-only] ========== 测试失败 ==========`);
    console.error(`[test-generate-prompt-only] 错误详情:`, error);
    console.error(`[test-generate-prompt-only] ========== 错误结束 ==========`);

    const errorMessage =
      error instanceof Error ? error.message : '未知错误';

    return NextResponse.json(
      {
        success: false,
        message: `操作失败: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}
