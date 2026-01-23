import { NextRequest, NextResponse } from 'next/server';
import { storyManager } from '@/storage/database/storyManager';
import { storyOutlineManager } from '@/storage/database/storyOutlineManager';
import { storyboardTextManager } from '@/storage/database/storyboardTextManager';
import { storyboardScriptManager } from '@/storage/database/storyboardScriptManager';

export const runtime = 'nodejs';

interface SceneData {
  id: string;
  title: string;
  duration: number;
  thumbnail: string;
  audio?: string;
  subtitle?: string;
  storyboardTextId: string;
  scriptId: string;
  sceneTitle: string;
  storyboardText: string;
  scriptContent: string;
  generatedScript?: any; // 添加已生成的脚本数据
  hasReferenceImages?: boolean; // 是否已生成参考图
  isVideoGenerated?: boolean;
}

const parseJsonIfString = (input: any): any => {
  let value = input;
  for (let i = 0; i < 2 && typeof value === 'string'; i += 1) {
    try {
      value = JSON.parse(value);
    } catch {
      break;
    }
  }
  return value;
};

const extractShotDurationSeconds = (scriptContent: any): number | undefined => {
  let script = parseJsonIfString(scriptContent);
  if (script?.video_script) {
    script = { ...script, video_script: parseJsonIfString(script.video_script) };
  }
  const videoScript = parseJsonIfString(script?.video_script);
  const shotInfo = parseJsonIfString(
    videoScript?.shot_info ??
      videoScript?.shot ??
      videoScript?.shot_setting ??
      script?.shot_info ??
      script?.shot
  );
  const raw = shotInfo?.shot_duration;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const direct = Number(raw);
    if (Number.isFinite(direct)) return direct;
    const match = raw.match(/(\d+(?:\.\d+)?)/);
    if (match) {
      const v = Number(match[1]);
      if (Number.isFinite(v)) return v;
    }
  }
  return undefined;
};

/**
 * GET /api/video-creation/scripts/[id]
 * 获取指定脚本的详细信息（包括分镜列表）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: storyId } = await params;

    // 获取故事信息
    const story = await storyManager.getStoryById(storyId);
    if (!story) {
      return NextResponse.json(
        {
          success: false,
          message: '未找到该脚本',
        },
        { status: 404 }
      );
    }

    // 获取大纲
    const outlines = await storyOutlineManager.getOutlinesByStoryId(storyId);

    const scenes: SceneData[] = [];

    for (const outline of outlines) {
      // 获取分镜文本
      const storyboardTexts = await storyboardTextManager.getStoryboardTextsByOutlineId(outline.id);

      for (const storyboardText of storyboardTexts) {
        // 获取分镜脚本
        const scripts = await storyboardScriptManager.getStoryboardScriptsByTextId(storyboardText.id);

        for (const script of scripts) {
          // scriptContent已经是对象了，直接使用

          const shotDuration = extractShotDurationSeconds(script.scriptContent);
          scenes.push({
            id: script.id,
            title: storyboardText.sceneTitle || `分镜 ${scenes.length + 1}`,
            duration: shotDuration ?? 0,
            thumbnail: script.imageUrl || '/placeholders/scene-thumbnail.svg',
            audio: undefined,
            subtitle: undefined,
            storyboardTextId: storyboardText.id,
            scriptId: storyId,  // 修复：使用 storyId 而不是 script.id
            sceneTitle: storyboardText.sceneTitle,
            storyboardText: storyboardText.storyboardText,
            scriptContent: script.scriptContent,
            generatedScript: script.scriptContent, // 直接使用scriptContent作为generatedScript
            hasReferenceImages: storyboardText.isCreatedReference,
            isVideoGenerated: storyboardText.isVideoGenerated,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: story.id,
        title: story.title || '未命名作品',
        storyText: story.storyText,
        generatedText: story.generatedText,
        scenes: scenes,
      },
    });
  } catch (error) {
    console.error('获取脚本详情失败:', error);

    const errorMessage =
      error instanceof Error ? error.message : '未知错误';

    return NextResponse.json(
      {
        success: false,
        message: `获取失败: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}
