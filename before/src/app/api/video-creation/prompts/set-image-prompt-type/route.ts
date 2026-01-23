import { NextRequest, NextResponse } from 'next/server';
import { promptsManager } from '@/storage/database/promptsManager';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const storyboardId = typeof body?.storyboardId === 'string' ? body.storyboardId : '';
    const imagePromptType = typeof body?.imagePromptType === 'string' ? body.imagePromptType : '';

    if (!storyboardId) {
      return NextResponse.json({ success: false, message: 'storyboardId 是必填参数' }, { status: 400 });
    }

    if (imagePromptType !== '首帧' && imagePromptType !== '尾帧') {
      return NextResponse.json({ success: false, message: 'imagePromptType 必须为 首帧 或 尾帧' }, { status: 400 });
    }

    const existing = await promptsManager.getPromptByStoryboardId(storyboardId);
    if (existing) {
      const updated = await promptsManager.updatePrompt(existing.id, { imagePromptType });
      return NextResponse.json({ success: true, data: updated });
    }

    const created = await promptsManager.createPrompt({ storyboardId, imagePromptType });
    return NextResponse.json({ success: true, data: created });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return NextResponse.json({ success: false, message: `更新失败: ${errorMessage}` }, { status: 500 });
  }
}

