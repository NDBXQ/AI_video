import { NextRequest, NextResponse } from 'next/server';
import { createCozeStorage } from '@/features/video-creation/services/image-generation/storage';
import { generateThumbnailInside } from '@/features/video-creation/services/image-generation/thumbnail';
import { publicResourceManager } from '@/storage/database';

export const runtime = 'nodejs';

function getSafeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 128);
}

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
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, message: '缺少 file' }, { status: 400 });
    }

    const type = (formData.get('type') || 'character') as
      | 'character'
      | 'background'
      | 'props'
      | 'music'
      | 'effect'
      | 'transition';

    if (!['character', 'background', 'props', 'music', 'effect', 'transition'].includes(type)) {
      return NextResponse.json({ success: false, message: 'type 参数无效' }, { status: 400 });
    }

    if (!['character', 'background', 'props'].includes(type)) {
      return NextResponse.json({ success: false, message: '当前仅支持上传角色/背景/道具图片' }, { status: 400 });
    }

    const fileName = getSafeFileName(file.name || 'upload');
    const mimeType = file.type || 'application/octet-stream';
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const storage = createCozeStorage();
    const originalKey = await storage.uploadFile({
      fileContent: fileBuffer,
      fileName: `public_${type}_${Date.now()}_${fileName}`,
      contentType: mimeType,
    });
    const originalUrl = await storage.generatePresignedUrl({ key: originalKey, expireTime: 604800 });

    const thumbBuffer = await generateThumbnailInside(fileBuffer, 480);
    const thumbKey = await storage.uploadFile({
      fileContent: thumbBuffer,
      fileName: `public_${type}_${Date.now()}_${fileName}_thumb.jpg`,
      contentType: 'image/jpeg',
    });
    const previewUrl = await storage.generatePresignedUrl({ key: thumbKey, expireTime: 604800 });

    const name = (formData.get('name') as string) || fileName;
    const description = (formData.get('description') as string) || '';
    const tags = parseCsv(formData.get('tags'));
    const applicableScenes = parseCsv(formData.get('applicableScenes'));

    const created = await publicResourceManager.createResource({
      type,
      source: 'upload',
      name,
      description,
      previewUrl,
      previewStorageKey: thumbKey,
      originalUrl,
      originalStorageKey: originalKey,
      tags,
      applicableScenes,
    });

    console.info('[content-library/public-resources/upload] ok', { id: created.id, type: created.type });
    return NextResponse.json({ success: true, data: created });
  } catch (error) {
    console.error('[content-library/public-resources/upload] failed:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
