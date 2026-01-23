import { NextRequest, NextResponse } from 'next/server';
import { createCozeStorage } from '@/features/video-creation/services/image-generation/storage';
import { generateImageByCoze } from '@/features/video-creation/services/image-generation/cozeClient';
import { downloadImage, generateThumbnailInside } from '@/features/video-creation/services/image-generation/thumbnail';
import { publicResourceManager } from '@/storage/database';

export const runtime = 'nodejs';

function parseCsv(value: unknown) {
  const raw = typeof value === 'string' ? value : '';
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .slice(0, 20);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const type = (body?.type || 'character') as 'character' | 'background' | 'props';
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
    const quantityRaw = typeof body?.quantity === 'number' ? body.quantity : 1;
    const quantity = Math.max(1, Math.min(4, quantityRaw));

    if (!['character', 'background', 'props'].includes(type)) {
      return NextResponse.json({ success: false, message: 'type 参数无效' }, { status: 400 });
    }
    if (prompt.length <= 0) {
      return NextResponse.json({ success: false, message: 'prompt 不能为空' }, { status: 400 });
    }

    const name = typeof body?.name === 'string' && body.name.trim().length > 0 ? body.name.trim() : prompt.slice(0, 40);
    const description = typeof body?.description === 'string' ? body.description : '';
    const tags = parseCsv(body?.tags);
    const applicableScenes = parseCsv(body?.applicableScenes);

    const storage = createCozeStorage();
    const created = [];

    const imageType = type === 'background' ? 'background' : type === 'character' ? 'role' : 'item';

    for (let i = 0; i < quantity; i += 1) {
      const apiImageUrl = await generateImageByCoze(prompt, imageType);
      const imageBuffer = await downloadImage(apiImageUrl, i);
      const thumbBuffer = await generateThumbnailInside(imageBuffer, 480);

      const originalKey = await storage.uploadFile({
        fileContent: imageBuffer,
        fileName: `public_ai_${type}_${Date.now()}_${i}_original.jpg`,
        contentType: 'image/jpeg',
      });
      const originalUrl = await storage.generatePresignedUrl({ key: originalKey, expireTime: 604800 });

      const thumbKey = await storage.uploadFile({
        fileContent: thumbBuffer,
        fileName: `public_ai_${type}_${Date.now()}_${i}_thumb.jpg`,
        contentType: 'image/jpeg',
      });
      const previewUrl = await storage.generatePresignedUrl({ key: thumbKey, expireTime: 604800 });

      const row = await publicResourceManager.createResource({
        type,
        source: 'ai',
        name: quantity === 1 ? name : `${name} ${i + 1}`,
        description: description || prompt,
        previewUrl,
        previewStorageKey: thumbKey,
        originalUrl,
        originalStorageKey: originalKey,
        tags,
        applicableScenes,
      });
      created.push(row);
    }

    console.info('[content-library/public-resources/ai-generate] ok', { count: created.length, type });
    return NextResponse.json({ success: true, data: created });
  } catch (error) {
    console.error('[content-library/public-resources/ai-generate] failed:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
