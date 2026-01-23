import { NextRequest, NextResponse } from 'next/server';
import { storyOutlineManager } from '@/storage/database/storyOutlineManager';
import { storyboardTextManager } from '@/storage/database/storyboardTextManager';
import { storyboardScriptManager } from '@/storage/database/storyboardScriptManager';

interface StoryboardScriptResponse {
  id: string;
  storyboardTextId: string;
  outlineId: string;
  outlineText: string;
  sceneTitle: string;
  sequence: number;
  scriptContent: string;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string | null;
}

/**
 * GET /api/storyboard-script/by-story/[storyId]
 * 获取某个故事的所有分镜脚本（通过storyId）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storyId: string }> }
) {
  try {
    const { storyId } = await params;

    if (!storyId) {
      return NextResponse.json(
        {
          success: false,
          message: '缺少storyId参数',
        },
        { status: 400 }
      );
    }

    // 1. 获取故事的所有大纲
    const outlines = await storyOutlineManager.getOutlinesByStoryId(storyId);

    if (!outlines || outlines.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        message: '该故事暂无大纲',
      });
    }

    // 2. 为每个大纲获取对应的分镜文本，再获取分镜脚本
    const results: StoryboardScriptResponse[] = [];

    for (const outline of outlines) {
      const storyboardTexts = await storyboardTextManager.getStoryboardTextsByOutlineId(outline.id);

      // 如果有分镜文本，获取对应的分镜脚本
      if (storyboardTexts && storyboardTexts.length > 0) {
        for (const text of storyboardTexts) {
          const scripts = await storyboardScriptManager.getStoryboardScriptsByTextId(text.id);

          // 如果有分镜脚本，添加到结果中
          if (scripts && scripts.length > 0) {
            for (const script of scripts) {
              results.push({
                id: script.id,
                storyboardTextId: script.storyboardTextId,
                outlineId: outline.id,
                outlineText: outline.outlineText,
                sceneTitle: text.sceneTitle,
                sequence: script.sequence,
                scriptContent: script.scriptContent,
                imageUrl: script.imageUrl,
                createdAt: script.createdAt,
                updatedAt: script.updatedAt,
              });
            }
          }
        }
      }
    }

    // 按序号排序
    results.sort((a, b) => a.sequence - b.sequence);

    return NextResponse.json({
      success: true,
      data: results,
      message: '获取成功',
    });
  } catch (error) {
    console.error('获取分镜脚本失败:', error);

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
