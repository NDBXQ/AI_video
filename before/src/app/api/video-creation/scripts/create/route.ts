import { NextRequest, NextResponse } from 'next/server';
import { storyboardScriptManager } from '@/storage/database/storyboardScriptManager';
import { promptManager } from '@/storage/database/promptManager';
import { storyboardTextManager } from '@/storage/database/storyboardTextManager';

const PROMPT_API_URL = 'https://jyyj7yy9p5.coze.site/run';
const PROMPT_API_TOKEN = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjI1NDgzMTMwLWQxYzAtNGZlNS05ZjJlLWRmNjU3OTFkMDJlNSJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbIktKQnBoRURUQlZEYk55QjM1aTg2Ykk4SkdRVVREUGVmIl0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzY3OTY1OTE2LCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NTkyNDU1Mzk1ODA5OTUxNzc4Iiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NTkzMzU1NzkwMjIwNTI1NjE5In0.bp0PZazNwFU-7qGkWG-scWxEQkzB9sTzGo6jxLo8-jOayiIPVE-nP5Me7JRdpE9VySfnN7-_t2q-k6IJ3yMLlGdX2hw-CGIL4ueJQIiLA_PdbyrJhven43CnISZSZddQgfRYkN2lIZNgoQA9M2t-6KBqJtZUlb2n3Kfx1uGEFM36rO4Z2oh-ZtzNLQmaNgDlB9Z4CTTnAgV6AVmqOVFT0hic6aSI4orbBXtYD9s_onJSRZQaTgfdxXi-rBPFntBX7EIL60WSv8tAKuNB8O2oVXgk4Eki5dF9d06HZrksXMi0F1zfyLOGCK1etnZXIvJUwmGz6FLZQrCPWAxn2Pizvg';


/**
 * 异步生成提示词并保存到数据库
 */
async function generateAndSavePromptAsync(storyboardId: string, scriptContent: any) {
  console.log(`[async-prompt] ========== 函数开始执行 ==========`);
  console.log(`[async-prompt] storyboardId: ${storyboardId}`);
  console.log(`[async-prompt] scriptContent type: ${typeof scriptContent}`);
  console.log(`[async-prompt] scriptContent value:`, scriptContent);

  try {
    console.log(`[async-prompt] scriptContent 是对象，开始转换为 Coze API 格式...`);
    // scriptContent 现在是对象类型，格式为：
    // { video_script: { shot, shot_content, video_content } }
    // 需要转换为：
    // { video_script: { shot_info: [...], shot_content: [...], video_content: [...] } }

    const scriptJson = scriptContent;
    console.log(`[async-prompt] scriptJson keys:`, Object.keys(scriptJson));
    console.log(`[async-prompt] scriptJson完整结构:`, JSON.stringify(scriptJson, null, 2));

    // 调用提示词生成API
    console.log(`[async-prompt] 正在调用提示词API: ${PROMPT_API_URL}`);

    console.log(`[async-prompt] 完整Coze API请求体:`, JSON.stringify(scriptJson, null, 2));

    const response = await fetch(PROMPT_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PROMPT_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(scriptJson),
    });

    console.log(`[async-prompt] API响应状态: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[async-prompt] API调用失败: ${response.status} - ${errorText}`);
      console.error(`[async-prompt] 完整错误响应:`, errorText);
      return;
    }

    const result = await response.json();
    console.log(`[async-prompt] 提示词生成成功`);
    console.log(`[async-prompt] 原始响应:`, JSON.stringify(result, null, 2));

    // 检查返回数据的结构
    console.log(`[async-prompt] 检查返回数据结构...`);
    console.log(`[async-prompt] result.video_prompt:`, result.video_prompt);
    console.log(`[async-prompt] result.image_prompt_type:`, result.image_prompt_type);
    console.log(`[async-prompt] result.image_prompt:`, result.image_prompt);
    console.log(`[async-prompt] result.run_id:`, result.run_id);

    // 安全访问字段
    const videoPrompt = result.video_prompt || null;
    const imagePromptType = result.image_prompt_type || null;
    const imagePrompt = result.image_prompt || null;
    const runId = result.run_id || null;

    console.log(`[async-prompt] 提取的字段:`, {
      videoPrompt,
      imagePromptType,
      imagePrompt,
      runId
    });

    // 保存到数据库
    console.log(`[async-prompt] 正在保存到数据库...`);
    const savedPrompt = await promptManager.createPrompt({
      storyboardId: storyboardId,
      videoPrompt: videoPrompt,
      imagePromptType: imagePromptType,
      imagePrompt: imagePrompt,
      runId: runId,
      scriptJson: JSON.stringify(scriptJson),
    });

    console.log(`[async-prompt] 提示词保存成功，ID: ${savedPrompt.id}`);
    console.log(`[async-prompt] ========== 异步生成提示词完成 ==========`);
  } catch (error) {
    console.error(`[async-prompt] ========== 异步生成提示词失败 ==========`);
    console.error(`[async-prompt] storyboardId: ${storyboardId}`);
    console.error(`[async-prompt] 错误详情:`, error);
    console.error(`[async-prompt] ========== 错误结束 ==========`);
    // 不抛出错误，避免影响主流程
  }
}

export const runtime = 'nodejs';

/**
 * POST /api/video-creation/scripts/create
 * 创建或更新分镜脚本（如果已存在则更新）
 */
export async function POST(request: NextRequest) {
  console.log(`[create-script] ========== 开始处理请求 ==========`);

  try {
    const body = await request.json();
    const { storyboardTextId, sequence, scriptContent, imageUrl } = body;

    console.log(`[create-script] 请求参数:`, {
      storyboardTextId,
      sequence,
      hasScriptContent: !!scriptContent,
      scriptContentType: typeof scriptContent,
      hasImageUrl: !!imageUrl
    });

    // 验证必填字段
    if (!storyboardTextId) {
      console.error(`[create-script] 缺少storyboardTextId`);
      return NextResponse.json(
        {
          success: false,
          message: 'storyboardTextId 是必填字段',
        },
        { status: 400 }
      );
    }

    if (!scriptContent) {
      console.error(`[create-script] 缺少scriptContent`);
      return NextResponse.json(
        {
          success: false,
          message: 'scriptContent 是必填字段',
        },
        { status: 400 }
      );
    }

    // 如果sequence为空，默认为1
    const scriptSequence = sequence ?? 1;

    // 检查是否已存在相同storyboardTextId和sequence的记录
    console.log(`[create-script] 检查是否存在现有记录...`);
    const existingScript = await storyboardScriptManager.getStoryboardScriptBySequence(
      storyboardTextId,
      scriptSequence
    );
    console.log(`[create-script] 现有记录:`, existingScript ? `id=${existingScript.id}` : '无');

    let script;
    let saveSuccess = false;

    // 将 scriptContent 对象序列化为字符串存储到数据库
    const scriptContentString = JSON.stringify(scriptContent);

    try {
      if (existingScript) {
        // 更新现有记录
        console.log(`[create-script] 更新已有分镜脚本: id=${existingScript.id}`);
        script = await storyboardScriptManager.updateStoryboardScript(existingScript.id, {
          scriptContent: scriptContentString,
          imageUrl: imageUrl || undefined,
        });
      } else {
        // 创建新记录
        console.log(`[create-script] 创建新分镜脚本`);
        script = await storyboardScriptManager.createStoryboardScript({
          storyboardTextId,
          sequence: scriptSequence,
          scriptContent: scriptContentString,
          imageUrl: imageUrl || undefined,
        });
      }
      saveSuccess = true;
      console.log(`[create-script] 脚本保存成功: id=${script?.id}`);
    } catch (dbError) {
      console.error(`[create-script] 脚本保存失败:`, dbError);
      console.error(`[create-script] 错误详情:`, dbError instanceof Error ? {
        name: dbError.name,
        message: dbError.message,
        stack: dbError.stack
      } : dbError);
      // 即使数据库保存失败，也尝试生成提示词
      console.log(`[create-script] 数据库保存失败，但仍尝试生成提示词`);
    }

    // 异步生成提示词（不等待结果，在后台执行）
    console.log(`[create-script] 准备异步生成提示词: storyboardTextId=${storyboardTextId}`);
    console.log(`[create-script] scriptContent类型: ${typeof scriptContent}`);
    console.log(`[create-script] 开始异步调用...`);

    // 不等待异步操作完成
    setImmediate(() => {
      generateAndSavePromptAsync(storyboardTextId, scriptContent);
    });

    console.log(`[create-script] 异步调用已启动（不等待结果）`);

    if (!saveSuccess) {
      return NextResponse.json(
        {
          success: false,
          message: '脚本保存失败，但提示词已开始生成',
          debugInfo: {
            storyboardTextId,
            sequence: scriptSequence,
            asyncPromptGeneration: {
              started: true,
              storyboardId: storyboardTextId,
              note: '虽然脚本保存失败，但提示词生成已启动，请查看服务器端日志'
            }
          }
        },
        { status: 500 }
      );
    }

    try {
      await storyboardTextManager.updateStoryboardText(storyboardTextId, { isScriptGenerated: true });
    } catch (e) {
      console.error('[create-script] 更新 storyboard_texts.is_script_generated 失败:', e);
    }

    return NextResponse.json({
      success: true,
      data: script,
      debugInfo: {
        storyboardTextId,
        sequence: scriptSequence,
        asyncPromptGeneration: {
          started: true,
          storyboardId: storyboardTextId,
          note: '提示词正在后台异步生成，请查看服务器端日志获取详细信息'
        }
      }
    });
  } catch (error) {
    console.error('[create-script] ========== 处理请求失败 ==========');
    console.error('[create-script] 错误详情:', error);

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
