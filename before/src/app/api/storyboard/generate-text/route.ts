import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 120; // 设置Next.js API路由最大执行时间为120秒

// Coze API 配置
const COZE_API_URL = process.env.COZE_API_URL || '';
const COZE_API_TOKEN = process.env.COZE_API_TOKEN || '';

interface CozeResponse {
  story_original: string;
  story_text: string;
  outline_original_list: Array<{
    outline: string;
    original: string;
  }>;
  run_id: string;
}

export async function POST(request: NextRequest) {
  try {
    // 获取请求体
    const body = await request.json();
    const { story_text, input_type } = body;

    console.log('[generate-text] 接收到分镜文本生成请求:', {
      input_type,
      story_text_length: story_text?.length || 0
    });

    if (!story_text) {
      return NextResponse.json(
        { success: false, message: '请输入故事内容' }, 
        { status: 400 }
      );
    }

    // 检查环境变量配置
    if (!COZE_API_URL || !COZE_API_TOKEN) {
      console.error('[generate-text] 缺少环境变量 COZE_API_URL 或 COZE_API_TOKEN');
      return NextResponse.json(
        { 
          success: false, 
          message: '服务器配置错误：缺少 API 配置' 
        },
        { status: 500 }
      );
    }

    console.log('[generate-text] 开始调用 Coze API...');
    console.log('[generate-text] Coze API URL:', COZE_API_URL);

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
          input_type: input_type || 'original',
          story_text: story_text,
        }),
      });
    } catch (fetchError) {
      console.error('[generate-text] Coze API 网络请求失败:', fetchError);
      return NextResponse.json(
        { 
          success: false, 
          message: 'Coze API 网络请求失败' 
        },
        { status: 500 }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generate-text] Coze API 返回错误:', response.status, errorText);
      return NextResponse.json(
        { 
          success: false, 
          message: `Coze API 返回错误: ${response.status}` 
        },
        { status: 500 }
      );
    }

    // 解析响应
    let cozeData: CozeResponse;
    try {
      cozeData = await response.json();
      console.log('[generate-text] Coze API 返回成功:', {
        has_story_original: !!cozeData.story_original,
        has_story_text: !!cozeData.story_text,
        outline_count: cozeData.outline_original_list?.length || 0,
        run_id: cozeData.run_id
      });
    } catch (parseError) {
      console.error('[generate-text] Coze API 响应解析失败:', parseError);
      return NextResponse.json(
        { 
          success: false, 
          message: 'Coze API 响应格式错误' 
        },
        { status: 500 }
      );
    }

    // 验证数据结构
    if (!cozeData.outline_original_list || !Array.isArray(cozeData.outline_original_list)) {
      console.error('[generate-text] Coze API 返回数据缺少 outline_original_list');
      return NextResponse.json(
        { 
          success: false, 
          message: 'Coze API 返回数据结构不正确' 
        },
        { status: 500 }
      );
    }

    // 构造返回数据
    const resultData = {
      story_text: cozeData.story_text || story_text,
      story_original: cozeData.story_original,
      outline_original_list: cozeData.outline_original_list,
      run_id: cozeData.run_id
    };

    console.log('[generate-text] 大纲生成成功，条目数:', resultData.outline_original_list.length);

    return NextResponse.json({
      success: true,
      data: resultData,
      message: '生成成功'
    });

  } catch (error) {
    console.error('[generate-text] API 处理错误:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    );
  }
}
