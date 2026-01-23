import { NextRequest, NextResponse } from 'next/server';
import { storyManager } from '@/storage/database/storyManager';
import { storyOutlineManager } from '@/storage/database/storyOutlineManager';
import { storyboardTextManager } from '@/storage/database/storyboardTextManager';
import { storyboardScriptManager } from '@/storage/database/storyboardScriptManager';
import type { Story } from '@/storage/database/shared/schema';

export const runtime = 'nodejs';

interface StoryResponse {
  id: string;
  storyId: string;
  title: string;
  duration: number;
  sceneCount: number;
  createdAt: string;
  storyText?: string;
  outlines?: OutlineData[];
}

interface OutlineData {
  id: string;
  sequence: number;
  outlineText: string;
  originalText: string;
  storyboardTexts?: StoryboardTextData[];
}

interface StoryboardTextData {
  id: string;
  sequence: number;
  sceneTitle: string;
  originalText: string;
  storyboardText: string;
  shotCut: boolean;
  scripts?: ScriptData[];
}

interface ScriptData {
  id: string;
  sequence: number;
  scriptContent: string;
  imageUrl?: string;
}

/**
 * GET /api/video-creation/scripts
 * 获取所有可用于视频创作的脚本（故事及其关联数据）
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const storyId = searchParams.get('storyId');

    console.log('[API] 获取脚本列表 - storyId:', storyId, 'userId:', userId);

    // 必须提供 storyId 或 userId 才能查询，否则返回空数组
    let stories: Story[] = [];
    if (storyId) {
      console.log('[API] 按 storyId 过滤:', storyId);
      const story = await storyManager.getStoryById(storyId);
      stories = story ? [story] : [];
    } else if (userId) {
      console.log('[API] 按 userId 过滤:', userId);
      stories = await storyManager.getStoriesByUserId(userId);
    } else {
      console.log('[API] 未提供 storyId 或 userId，返回空数组');
      stories = [];
    }

    console.log('[API] 查询到的故事数量:', stories.length);

    const storyList: StoryResponse[] = [];

    for (const story of stories) {
      // 获取大纲
      const outlines = await storyOutlineManager.getOutlinesByStoryId(story.id);

      const outlineData: OutlineData[] = [];

      let totalScenes = 0;
      let totalDuration = 0;

      for (const outline of outlines) {
        // 获取分镜文本
        const storyboardTexts = await storyboardTextManager.getStoryboardTextsByOutlineId(outline.id);

        const storyboardTextData: StoryboardTextData[] = [];

        for (const storyboardText of storyboardTexts) {
          // 获取分镜脚本
          const scripts = await storyboardScriptManager.getStoryboardScriptsByTextId(storyboardText.id);

          // 计算场景数量
          if (scripts.length > 0) {
            totalScenes += scripts.length;
            // 假设每个场景 5-10 秒，这里简单计算
            totalDuration += scripts.length * 8;
          }

          storyboardTextData.push({
            id: storyboardText.id,
            sequence: storyboardText.sequence,
            sceneTitle: storyboardText.sceneTitle,
            originalText: storyboardText.originalText,
            storyboardText: storyboardText.storyboardText,
            shotCut: storyboardText.shotCut,
            scripts: scripts.map(s => ({
              id: s.id,
              sequence: s.sequence,
              scriptContent: s.scriptContent,
              imageUrl: s.imageUrl || undefined,
            })),
          });
        }

        outlineData.push({
          id: outline.id,
          sequence: outline.sequence,
          outlineText: outline.outlineText,
          originalText: outline.originalText,
          storyboardTexts: storyboardTextData,
        });
      }

      storyList.push({
        id: story.id,
        storyId: story.id,
        title: story.title || '未命名作品',
        duration: totalDuration || 45, // 默认 45 秒
        sceneCount: totalScenes || 5, // 默认 5 个场景
        createdAt: story.createdAt,
        storyText: story.storyText,
        outlines: outlineData,
      });
    }

    return NextResponse.json({
      success: true,
      data: storyList,
    });
  } catch (error) {
    console.error('获取脚本列表失败:', error);

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
