import { NextRequest, NextResponse } from 'next/server';
import { storyboardScriptManager } from '@/storage/database/storyboardScriptManager';

export const runtime = 'nodejs';

/**
 * GET /api/video-creation/storyboards/[storyboardId]/script
 * 根据分镜ID获取分镜脚本
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storyboardId: string }> }
) {
  try {
    const { storyboardId } = await params;

    // 获取该分镜下的所有脚本（按序列号排序）
    const scripts = await storyboardScriptManager.getStoryboardScriptsByTextId(storyboardId);

    if (!scripts || scripts.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: '未找到该分镜的脚本',
        },
        { status: 404 }
      );
    }

    // 返回所有脚本（按序列号排序）
    return NextResponse.json({
      success: true,
      data: {
        scripts: scripts.map(script => ({
          id: script.id,
          storyboardTextId: script.storyboardTextId,
          sequence: script.sequence,
          scriptContent: script.scriptContent,
        })),
      },
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
