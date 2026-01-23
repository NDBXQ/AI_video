import { NextRequest, NextResponse } from 'next/server';
import { storyboardScriptManager } from '@/storage/database/storyboardScriptManager';
import { storyboardTextManager } from '@/storage/database/storyboardTextManager';

export const runtime = 'nodejs';
export const maxDuration = 120; // 120秒超时

interface StoryboardScriptRequest {
  storyboard_text: string;
  storyboardTextId?: string; // 可选，用于保存到数据库
  sequence?: number; // 可选，用于保存到数据库
}

interface SceneScript {
  scene_number: number;
  scene_title: string;
  shot_type: string;
  duration: string;
  description: string;
  camera_movement: string;
  audio: string;
  notes: string;
}

interface GeneratedScript {
  storyboard_id: string;
  title: string;
  scenes: SceneScript[];
  total_duration: string;
  generated_at: string;
}

/**
 * POST /api/storyboard/generate-script
 * 生成分镜脚本
 */
export async function POST(request: NextRequest) {
  try {
    const body: StoryboardScriptRequest = await request.json();

    const { storyboard_text, storyboardTextId, sequence } = body;

    // 验证必填参数
    if (!storyboard_text || typeof storyboard_text !== 'string') {
      return NextResponse.json(
        {
          success: false,
          message: '缺少必填参数：storyboard_text',
        },
        { status: 400 }
      );
    }

    // 模拟生成延迟
    await new Promise(resolve => setTimeout(resolve, 1500));

    // 解析分镜文本，生成脚本（这里使用模拟逻辑）
    const scenes: SceneScript[] = [];

    // 简单的模拟生成逻辑：根据文本中的"【场景X】"标记生成场景
    const sceneMatches = storyboard_text.match(/【场景(\d+)】/g) || [];

    if (sceneMatches.length === 0) {
      // 如果没有找到场景标记，生成一个默认场景
      scenes.push({
        scene_number: 1,
        scene_title: '开场镜头',
        shot_type: '全景',
        duration: '3秒',
        description: storyboard_text.slice(0, 100) + '...',
        camera_movement: '固定镜头',
        audio: '背景音乐',
        notes: '自动生成的场景'
      });
    } else {
      // 为每个场景标记生成分镜脚本
      sceneMatches.forEach((match, index) => {
        const sceneNum = index + 1;
        scenes.push({
          scene_number: sceneNum,
          scene_title: `场景${sceneNum}`,
          shot_type: ['全景', '中景', '特写', '近景'][sceneNum % 4],
          duration: `${2 + (sceneNum % 3)}秒`,
          description: `场景${sceneNum}的画面描述，根据分镜文本自动生成详细的视觉元素、构图等信息`,
          camera_movement: ['固定镜头', '跟随镜头', '推镜头', '拉镜头'][sceneNum % 4],
          audio: `场景${sceneNum}的音频说明，包括背景音乐、音效、对白等`,
          notes: 'AI生成的分镜脚本'
        });
      });
    }

    // 计算总时长
    const totalSeconds = scenes.reduce((sum, scene) => {
      const match = scene.duration.match(/(\d+)/);
      return sum + (match ? parseInt(match[0]) : 0);
    }, 0);
    const totalDuration = `${totalSeconds}秒`;

    // 将脚本内容转换为JSON字符串
    const scriptContent = JSON.stringify(scenes, null, 2);

    // 如果提供了storyboardTextId和sequence，保存到数据库
    let savedScript = null;
    if (storyboardTextId && sequence !== undefined) {
      try {
        savedScript = await storyboardScriptManager.createStoryboardScript({
          storyboardTextId,
          sequence,
          scriptContent,
        });
        console.log('分镜脚本已保存到数据库:', savedScript.id);
        try {
          await storyboardTextManager.updateStoryboardText(storyboardTextId, { isScriptGenerated: true });
        } catch (e) {
          console.error('[generate-script] 更新 storyboard_texts.is_script_generated 失败:', e);
        }
      } catch (dbError) {
        console.error('保存分镜脚本到数据库失败:', dbError);
        // 不影响返回结果，继续执行
      }
    }

    const result: GeneratedScript = {
      storyboard_id: `sb${Date.now()}`,
      title: 'AI生成的分镜脚本',
      scenes,
      total_duration: totalDuration,
      generated_at: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        savedId: savedScript?.id, // 返回保存的ID
      },
      message: '分镜脚本生成成功',
    });
  } catch (error) {
    console.error('生成分镜脚本失败:', error);

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
