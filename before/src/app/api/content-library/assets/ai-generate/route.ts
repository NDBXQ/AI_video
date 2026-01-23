import { NextRequest, NextResponse } from 'next/server';
import { createCozeStorage } from '@/features/video-creation/services/image-generation/storage';
import { generateImageByCoze } from '@/features/video-creation/services/image-generation/cozeClient';
import { downloadImage, generateThumbnailInside } from '@/features/video-creation/services/image-generation/thumbnail';
import { libraryAssetManager } from '@/storage/database';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
    const quantityRaw = typeof body?.quantity === 'number' ? body.quantity : 1;
    const quantity = Math.max(1, Math.min(4, quantityRaw));

    if (prompt.length <= 0) {
      return NextResponse.json({ success: false, message: 'prompt 不能为空' }, { status: 400 });
    }

    const storage = createCozeStorage();

    const created = [];
    for (let i = 0; i < quantity; i += 1) {
      const apiImageUrl = await generateImageByCoze(prompt, 'item');
      const imageBuffer = await downloadImage(apiImageUrl, i);
      const thumbBuffer = await generateThumbnailInside(imageBuffer, 480);

      const originalKey = await storage.uploadFile({
        fileContent: imageBuffer,
        fileName: `library_ai_${Date.now()}_${i}_original.jpg`,
        contentType: 'image/jpeg',
      });
      const url = await storage.generatePresignedUrl({ key: originalKey, expireTime: 604800 });

      const thumbKey = await storage.uploadFile({
        fileContent: thumbBuffer,
        fileName: `library_ai_${Date.now()}_${i}_thumb.jpg`,
        contentType: 'image/jpeg',
      });
      const thumbnailUrl = await storage.generatePresignedUrl({ key: thumbKey, expireTime: 604800 });

      const row = await libraryAssetManager.createAsset({
        type: 'image',
        source: 'ai',
        title: prompt.slice(0, 80),
        prompt,
        tags: [],
        mimeType: 'image/jpeg',
        size: imageBuffer.byteLength,
        url,
        storageKey: originalKey,
        thumbnailUrl,
        thumbnailStorageKey: thumbKey,
      });
      created.push(row);
    }

    console.info('[content-library/assets/ai-generate] ok', { count: created.length });
    return NextResponse.json({ success: true, data: created });
  } catch (error) {
    console.error('[content-library/assets/ai-generate] failed:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
