import { NextRequest, NextResponse } from 'next/server';
import { generatedImageManager } from '@/storage/database/generatedImageManager';
import { storyboardScriptManager } from '@/storage/database/storyboardScriptManager';
import { normalizeStoryboardId, resolveStoryIdByStoryboardTextId } from '@/features/video-creation/services/image-generation/story';

export const runtime = 'nodejs';

/**
 * GET /api/video-creation/images?storyboardId=xxx
 * GET /api/video-creation/images?storyId=xxx
 * GET /api/video-creation/images?storyId=xxx&names=xxx,yyy,zzz
 * 获取指定分镜或故事的生成的图片
 *
 * 查询参数：
 * - storyboardId: 分镜ID（可选，与storyId二选一）
 * - storyId: 故事ID（可选，与storyboardId二选一）
 * - names: 名字列表，逗号分隔（可选，用于过滤角色/背景/物品名）
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const storyboardId = searchParams.get('storyboardId');
    const storyId = searchParams.get('storyId');
    const namesParam = searchParams.get('names');

    if (!storyboardId && !storyId) {
      return NextResponse.json(
        {
          success: false,
          message: 'storyboardId 或 storyId 必须提供一个',
        },
        { status: 400 }
      );
    }

    const actualStoryboardId = storyboardId ? normalizeStoryboardId(storyboardId) : undefined;
    const resolvedStoryId = storyId
      ? storyId
      : await resolveStoryIdByStoryboardTextId(actualStoryboardId!);

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

    const extractNamesFromScriptJson = (scriptJson: any): string[] => {
      const script = parseJsonIfString(scriptJson);
      const videoContent =
        parseJsonIfString(script?.video_script?.video_content) ??
        parseJsonIfString(script?.video_content) ??
        parseJsonIfString(script);

      const names: string[] = [];
      if (videoContent?.background) {
        const bgName = videoContent.background.background_name || videoContent.background.name;
        if (typeof bgName === 'string' && bgName.trim().length > 0) names.push(bgName.trim());
      }
      if (Array.isArray(videoContent?.roles)) {
        for (const role of videoContent.roles) {
          const roleName = role?.role_name || role?.name;
          if (typeof roleName === 'string' && roleName.trim().length > 0) names.push(roleName.trim());
        }
      }
      const items = Array.isArray(videoContent?.items) ? videoContent.items : [];
      const otherItems = Array.isArray(videoContent?.other_items) ? videoContent.other_items : [];
      for (const item of [...items, ...otherItems]) {
        const itemName = item?.item_name || item?.name;
        if (typeof itemName === 'string' && itemName.trim().length > 0) names.push(itemName.trim());
      }
      return Array.from(new Set(names));
    };

    let names: string[] = [];

    // 如果有名字过滤参数，使用新方法查询
    if (namesParam) {
      names = namesParam.split(',').map(n => n.trim()).filter(n => n.length > 0);
    } else if (actualStoryboardId) {
      try {
        const scripts = await storyboardScriptManager.getStoryboardScriptsByTextId(actualStoryboardId);
        const primaryScript = scripts.find((s) => s?.scriptContent != null) ?? null;
        if (primaryScript) {
          names = extractNamesFromScriptJson(primaryScript.scriptContent);
        }
      } catch {
        names = [];
      }
    }

    console.log('[API] 获取图片列表', {
      storyboardId: actualStoryboardId,
      storyId: resolvedStoryId,
      namesCount: names.length,
      namesPreview: names.slice(0, 10),
    });

    if (names.length > 0) {
      const composedName = actualStoryboardId ? `合成图片_${actualStoryboardId}` : undefined;
      const [matchedImages, composedImagesAll] = await Promise.all([
        generatedImageManager.getGeneratedImagesByStoryIdAndNames(resolvedStoryId, names, true),
        generatedImageManager.getComposedImagesByStoryId(resolvedStoryId),
      ]);

      const composedImages = composedName
        ? composedImagesAll.filter((img: { name: string }) => img.name === composedName)
        : composedImagesAll;

      const images = [...composedImages, ...matchedImages].sort((a, b) => {
        const ta = typeof a.createdAt === 'string' ? Date.parse(a.createdAt) : 0;
        const tb = typeof b.createdAt === 'string' ? Date.parse(b.createdAt) : 0;
        return ta - tb;
      });

      console.log('[API] 图片列表返回', {
        matchedCount: matchedImages.length,
        composedCount: composedImages.length,
        total: images.length,
      });

      return NextResponse.json({ success: true, data: images });
    }

    const images = await generatedImageManager.getGeneratedImagesByStoryId(resolvedStoryId);
    return NextResponse.json({ success: true, data: images });
  } catch (error) {
    console.error('获取图片列表失败:', error);

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
