import { NextRequest, NextResponse } from 'next/server';
import { createCozeStorage } from '@/features/video-creation/services/image-generation/storage';
import { generateThumbnail } from '@/features/video-creation/services/image-generation/thumbnail';
import { normalizeStoryboardId, resolveStoryIdByStoryboardTextId } from '@/features/video-creation/services/image-generation/story';
import { generatedImageManager } from '@/storage/database/generatedImageManager';
import { storyboardTextManager } from '@/storage/database/storyboardTextManager';

export const runtime = 'nodejs';
export const maxDuration = 120;

const allowedCategories = ['background', 'role', 'item'] as const;
type AllowedCategory = (typeof allowedCategories)[number];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const storyboardId = String(formData.get('storyboardId') || '');
    const name = String(formData.get('name') || '').trim();
    const categoryRaw = String(formData.get('category') || '').trim();
    const description = String(formData.get('description') || '').trim();

    if (!storyboardId) {
      return NextResponse.json({ success: false, message: 'storyboardId 是必填参数' }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ success: false, message: 'name 是必填参数' }, { status: 400 });
    }
    if (!allowedCategories.includes(categoryRaw as AllowedCategory)) {
      return NextResponse.json({ success: false, message: 'category 非法' }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, message: 'file 是必填参数' }, { status: 400 });
    }

    const actualStoryboardId = normalizeStoryboardId(storyboardId);
    const storyId = await resolveStoryIdByStoryboardTextId(actualStoryboardId);

    const bytes = Buffer.from(await file.arrayBuffer());
    const thumbnailBytes = await generateThumbnail(bytes);

    const storage = createCozeStorage();
    const timestamp = Date.now();

    const imageStorageKey = await storage.uploadFile({
      fileContent: bytes,
      fileName: `reference_${actualStoryboardId}_${timestamp}.jpg`,
      contentType: file.type && file.type.length > 0 ? file.type : 'image/jpeg',
    });

    const imageUrl = await storage.generatePresignedUrl({
      key: imageStorageKey,
      expireTime: 604800,
    });

    const thumbnailStorageKey = await storage.uploadFile({
      fileContent: thumbnailBytes,
      fileName: `reference_${actualStoryboardId}_${timestamp}_thumbnail.jpg`,
      contentType: 'image/jpeg',
    });

    const thumbnailUrl = await storage.generatePresignedUrl({
      key: thumbnailStorageKey,
      expireTime: 604800,
    });

    const category = categoryRaw as AllowedCategory;
    const existing = await generatedImageManager.getGeneratedImageByName(storyId, name, category);

    const saved =
      existing != null
        ? await generatedImageManager.updateGeneratedImage(existing.id, {
            name,
            description: description.length > 0 ? description : existing.description,
            url: imageUrl,
            storageKey: imageStorageKey,
            thumbnailUrl,
            thumbnailStorageKey,
            category,
          })
        : await generatedImageManager.createGeneratedImage({
            storyId,
            name,
            description: description.length > 0 ? description : undefined,
            url: imageUrl,
            storageKey: imageStorageKey,
            thumbnailUrl,
            thumbnailStorageKey,
            category,
          });

    if (!saved) {
      return NextResponse.json({ success: false, message: '写入数据库失败' }, { status: 500 });
    }

    try {
      await storyboardTextManager.updateStoryboardText(actualStoryboardId, { isCreatedReference: true });
    } catch (e) {
      console.error('[upload-reference-image] 更新 storyboard_texts.is_created_reference 失败:', e);
    }

    return NextResponse.json({
      success: true,
      data: {
        image: {
          id: saved.id,
          name: saved.name,
          url: saved.url,
          thumbnailUrl: saved.thumbnailUrl,
          category: saved.category,
          description: saved.description,
        },
      },
    });
  } catch (error) {
    console.error('[upload-reference-image] 上传失败:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return NextResponse.json({ success: false, message: `上传失败: ${errorMessage}` }, { status: 500 });
  }
}
