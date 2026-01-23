import { NextRequest, NextResponse } from 'next/server';
import { storyOutlineManager } from '@/storage/database/storyOutlineManager';
import { storyboardTextManager } from '@/storage/database/storyboardTextManager';

interface StoryboardTextResponse {
  id: string;
  outlineId: string;
  outlineText: string;
  sequence: number;
  sceneTitle: string;
  originalText: string;
  shotCut: boolean;
  storyboardText: string;
  createdAt: string;
  updatedAt: string | null;
}

/**
 * GET /api/storyboard-text/by-story/[storyId]
 * 获取某个故事的所有分镜文本（通过storyId）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storyId: string }> }
) {
  try {
    const { storyId } = await params;

    console.log('收到请求，storyId:', storyId);

    if (!storyId) {
      console.error('缺少storyId参数');
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

    // 2. 为每个大纲获取对应的分镜文本
    const results: StoryboardTextResponse[] = [];

    for (const outline of outlines) {
      const storyboardTexts = await storyboardTextManager.getStoryboardTextsByOutlineId(outline.id);

      // 如果有分镜文本，添加到结果中
      if (storyboardTexts && storyboardTexts.length > 0) {
        for (const text of storyboardTexts) {
          results.push({
            id: text.id,
            outlineId: text.outlineId,
            outlineText: outline.outlineText,
            sequence: text.sequence,
            sceneTitle: text.sceneTitle,
            originalText: text.originalText,
            shotCut: text.shotCut,
            storyboardText: text.storyboardText,
            createdAt: text.createdAt,
            updatedAt: text.updatedAt,
          });
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
    console.error('获取分镜文本失败:', error);

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
