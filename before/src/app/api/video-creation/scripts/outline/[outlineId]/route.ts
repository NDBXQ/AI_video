import { NextRequest, NextResponse } from 'next/server';
import { storyOutlineManager } from '@/storage/database/storyOutlineManager';
import { storyboardTextManager } from '@/storage/database/storyboardTextManager';
import { storyboardScriptManager } from '@/storage/database/storyboardScriptManager';
import { promptsManager } from '@/storage/database/promptsManager';

export const runtime = 'nodejs';

/**
 * GET /api/video-creation/scripts/outline/[outlineId]
 * 获取指定大纲的所有分镜文本内容
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ outlineId: string }> }
) {
  try {
    const { outlineId } = await params;

    // 获取大纲信息（以获取storyId）
    const outline = await storyOutlineManager.getOutlineById(outlineId);
    if (!outline) {
      return NextResponse.json(
        {
          success: false,
          message: '未找到该大纲',
        },
        { status: 404 }
      );
    }

    const storyId = outline.storyId;

    // 获取大纲的分镜文本
    const storyboardTexts = await storyboardTextManager.getStoryboardTextsByOutlineId(outlineId);
    console.log(`[API /outline/${outlineId}] ========== 调试信息 ==========`);
    console.log(`[API /outline/${outlineId}] 获取到的分镜文本数量:`, storyboardTexts.length);
    storyboardTexts.forEach((text, index) => {
      console.log(`[API /outline/${outlineId}]   [${index}] ID: ${text.id}, 序号: ${text.sequence}, 标题: ${text.sceneTitle}`);
      console.log(`[API /outline/${outlineId}]   [${index}] storyboardText长度: ${text.storyboardText?.length || 0}`);
    });

    const scenes: any[] = [];
    let globalSequence = 1; // 全局递增序号

    for (const storyboardText of storyboardTexts) {
      console.log(`[API /outline/${outlineId}] --- 处理分镜文本: ID=${storyboardText.id}, 标题=${storyboardText.sceneTitle} ---`);

      // 获取该 storyboardText 关联的分镜脚本
      const scripts = await storyboardScriptManager.getStoryboardScriptsByTextId(storyboardText.id);
      console.log(`[API /outline/${outlineId}] 该分镜文本关联的脚本数量:`, scripts.length);
      const script = scripts.find(s => s.sequence === 1) || scripts[0] || null;

      // 查询videoPrompt
      const promptRecord = await promptsManager.getPromptByStoryboardId(storyboardText.id);

      // 解析分镜脚本
      let generatedScript = null;
      if (script) {
        try {
          generatedScript = typeof script.scriptContent === 'string' ? JSON.parse(script.scriptContent) : script.scriptContent;
        } catch (e) {
          console.error('解析分镜脚本失败:', e);
          generatedScript = script.scriptContent;
        }
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
        let parsed = parseJsonIfString(scriptContent);
        if (parsed?.video_script) {
          parsed = { ...parsed, video_script: parseJsonIfString(parsed.video_script) };
        }
        const videoScript = parseJsonIfString(parsed?.video_script);
        const shotInfo = parseJsonIfString(
          videoScript?.shot_info ??
            videoScript?.shot ??
            videoScript?.shot_setting ??
            parsed?.shot_info ??
            parsed?.shot
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

      const shotDuration = extractShotDurationSeconds(script?.scriptContent);

      // 直接创建 Scene（每个 storyboardText 对应一个 Scene）
      const newScene = {
        id: storyboardText.id,
        storyId: storyId,
        storyboardTextId: storyboardText.id,
        sequence: globalSequence++,
        title: storyboardText.sceneTitle || `分镜 ${globalSequence}`,
        content: storyboardText.storyboardText || storyboardText.originalText,
        duration: shotDuration ?? 0,
        thumbnail: script?.imageUrl || '/placeholders/scene-thumbnail.svg',
        audio: undefined,
        subtitle: undefined,
        outlineId: outlineId,
        sceneTitle: storyboardText.sceneTitle,
        originalText: storyboardText.originalText,
        shot_cut: storyboardText.shotCut || false,
        storyboardIndex: 0,
        scriptContent: script?.scriptContent || storyboardText.storyboardText || storyboardText.originalText,
        scriptGenerated: !!script,
        generatedScript: generatedScript,
        videoPrompt: promptRecord?.videoPrompt || undefined,
        imagePromptType: promptRecord?.imagePromptType || undefined,
        hasReferenceImages: storyboardText.isCreatedReference || false,
        isVideoGenerated: storyboardText.isVideoGenerated || false,
      };

      scenes.push(newScene);
      console.log(`[API /outline/${outlineId}] ✓ 创建Scene: ID=${newScene.id}, 标题=${newScene.title}, shot_cut=${newScene.shot_cut}, hasGeneratedScript=!!${generatedScript}, hasReferenceImages=${newScene.hasReferenceImages}`);
    }

    console.log(`[API /outline/${outlineId}] ========== 最终结果 ==========`);
    console.log(`[API /outline/${outlineId}] 总共创建`, scenes.length, '个Scene');
    scenes.forEach((scene, index) => {
      console.log(`[API /outline/${outlineId}]   [${index}] ID=${scene.id}, 标题=${scene.title}, sequence=${scene.sequence}`);
    });

    return NextResponse.json({
      success: true,
      data: scenes,
    });
  } catch (error) {
    console.error('获取大纲分镜失败:', error);

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
