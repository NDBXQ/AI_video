import { NextRequest, NextResponse } from 'next/server';
import { storyboardTextManager } from '@/storage/database/storyboardTextManager';
import { storyOutlineManager } from '@/storage/database/storyOutlineManager';
import { storyManager } from '@/storage/database/storyManager';

export const maxDuration = 180; // 设置Next.js API路由最大执行时间为180秒（3分钟）

// Coze API 配置
const COZE_API_URL = process.env.CREATE_STORYBOARD_TEXT_URL || '';
const COZE_API_TOKEN = process.env.CREATE_STORYBOARD_TEXT_TOKEN || '';

interface CozeRequest {
  outline: string;
  original: string;
  outlineId?: string;
  sequence?: number;
}

interface StoryboardItem {
  shot_cut: boolean;
  storyboard_text: string;
}

interface CozeResponse {
  storyboard_list: StoryboardItem[];
  run_id: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: CozeRequest = await request.json();
    const { outline, original, outlineId, sequence } = body;

    console.log('[coze-generate-text] 接收到分镜文本生成请求:', {
      outline_length: outline?.length || 0,
      original_length: original?.length || 0,
      outlineId,
      sequence,
    });

    if (!outline && !original) {
      return NextResponse.json(
        { success: false, message: '请提供大纲或原文内容' },
        { status: 400 }
      );
    }

    // 检查环境变量配置
    if (!COZE_API_URL || !COZE_API_TOKEN) {
      console.error('[coze-generate-text] 缺少环境变量 CREATE_STORYBOARD_TEXT_URL 或 CREATE_STORYBOARD_TEXT_TOKEN');
      return NextResponse.json(
        {
          success: false,
          message: '服务器配置错误：缺少 API 配置',
        },
        { status: 500 }
      );
    }

    console.log('[coze-generate-text] 开始调用 Coze API...');
    console.log('[coze-generate-text] Coze API URL:', COZE_API_URL);

    // 调用 Coze API
    let response;
    try {
      response = await fetch(COZE_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${COZE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          outline: outline || '',
          original: original || '',
        }),
      });
    } catch (fetchError) {
      console.error('[coze-generate-text] Coze API 网络请求失败:', fetchError);
      return NextResponse.json(
        {
          success: false,
          message: 'Coze API 网络请求失败',
        },
        { status: 500 }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[coze-generate-text] Coze API 返回错误:', response.status, errorText);
      return NextResponse.json(
        {
          success: false,
          message: `Coze API 返回错误: ${response.status}`,
        },
        { status: 500 }
      );
    }

    // 解析响应
    let cozeData: CozeResponse;
    try {
      cozeData = await response.json();
      console.log('[coze-generate-text] Coze API 返回成功:', {
        storyboard_count: cozeData.storyboard_list?.length || 0,
        run_id: cozeData.run_id,
      });
    } catch (parseError) {
      console.error('[coze-generate-text] Coze API 响应解析失败:', parseError);
      return NextResponse.json(
        {
          success: false,
          message: 'Coze API 响应格式错误',
        },
        { status: 500 }
      );
    }

    // 验证数据结构
    if (!cozeData.storyboard_list || !Array.isArray(cozeData.storyboard_list) || cozeData.storyboard_list.length === 0) {
      console.error('[coze-generate-text] Coze API 返回数据缺少 storyboard_list');
      return NextResponse.json(
        {
          success: false,
          message: 'Coze API 返回数据结构不正确',
        },
        { status: 500 }
      );
    }

    console.log('[coze-generate-text] 分镜列表详情:', {
      count: cozeData.storyboard_list.length,
      items: cozeData.storyboard_list.map((item, idx) => ({
        index: idx,
        shot_cut: item.shot_cut,
        text_preview: item.storyboard_text?.slice(0, 50) + '...'
      }))
    });

    // 保存到数据库
    let savedStoryboardText = null;
    let storyId: string | null = null;

    if (outlineId) {
      try {
        // 1. 通过 outlineId 获取大纲信息，以便获取 storyId
        const outlineRecord = await storyOutlineManager.getOutlineById(outlineId);
        if (outlineRecord) {
          storyId = outlineRecord.storyId;
          console.log('[coze-generate-text] 找到大纲记录，storyId:', storyId);
        } else {
          console.warn('[coze-generate-text] 未找到 outlineId 对应的大纲记录:', outlineId);
        }

        console.log('[coze-generate-text] 删除该大纲已存在的分镜文本记录, outlineId:', outlineId);
        await storyboardTextManager.deleteStoryboardTextsByOutlineId(outlineId);

        const sceneTitleBase = outline?.slice(0, 100) || `场景${sequence ?? 1}`;
        console.log('[coze-generate-text] 批量创建分镜文本记录, count:', cozeData.storyboard_list.length);

        const createdTexts = await storyboardTextManager.createStoryboardTexts(
          cozeData.storyboard_list.map((item, idx) => ({
            outlineId,
            sequence: idx + 1,
            sceneTitle: `${sceneTitleBase} - 镜头${idx + 1}`,
            originalText: original || '',
            shotCut: !!item.shot_cut,
            storyboardText: item.storyboard_text || '',
          }))
        );

        savedStoryboardText = createdTexts[0] || null;

        console.log('[coze-generate-text] 分镜文本已保存到数据库, created_count:', createdTexts.length);

        // 3. 更新故事进度状态为 'text'
        if (storyId) {
          try {
            const updatedStory = await storyManager.updateProgressStage(storyId, 'text');
            if (updatedStory) {
              console.log('[coze-generate-text] 故事进度已更新为 text, storyId:', storyId);
            } else {
              console.warn('[coze-generate-text] 更新故事进度失败，未找到故事, storyId:', storyId);
            }
          } catch (progressError) {
            console.error('[coze-generate-text] 更新故事进度失败:', progressError);
            // 不阻断流程，继续返回结果
          }
        }
      } catch (dbError) {
        console.error('[coze-generate-text] 保存分镜文本到数据库失败:', dbError);
        // 不阻断流程，继续返回结果
      }
    }

    console.log('[coze-generate-text] 分镜文本生成成功');

    return NextResponse.json({
      success: true,
      data: {
        shotCut: cozeData.storyboard_list.some((item) => !!item.shot_cut),
        storyboardText: cozeData.storyboard_list[0]?.storyboard_text || '',
        storyboardTexts: (savedStoryboardText && outlineId
          ? await storyboardTextManager.getStoryboardTextsByOutlineId(outlineId)
          : []
        ).map((t) => ({
          id: t.id,
          sequence: t.sequence,
          shotCut: t.shotCut,
          storyboardText: t.storyboardText,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        })),
        runId: cozeData.run_id,
        savedId: savedStoryboardText?.id,
        storyId: storyId,
      },
      message: '生成成功',
    });
  } catch (error) {
    console.error('[coze-generate-text] API 处理错误:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
