import { NextRequest, NextResponse } from 'next/server';
import { createCozeStorage } from '@/features/video-creation/services/image-generation/storage';
import { generateThumbnailInside } from '@/features/video-creation/services/image-generation/thumbnail';
import { libraryAssetManager } from '@/storage/database';

export const runtime = 'nodejs';

function getSafeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 128);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, message: '缺少 file' }, { status: 400 });
    }

    const type = (formData.get('type') || 'image') as 'image' | 'video' | 'audio';
    if (!['image', 'video', 'audio'].includes(type)) {
      return NextResponse.json({ success: false, message: 'type 参数无效' }, { status: 400 });
    }

    if (type !== 'image') {
      return NextResponse.json({ success: false, message: '当前仅支持上传图片素材' }, { status: 400 });
    }

    const fileName = getSafeFileName(file.name || 'upload');
    const mimeType = file.type || 'application/octet-stream';
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const storage = createCozeStorage();

    const originalKey = await storage.uploadFile({
      fileContent: fileBuffer,
      fileName: `library_${Date.now()}_${fileName}`,
      contentType: mimeType,
    });
    const url = await storage.generatePresignedUrl({ key: originalKey, expireTime: 604800 });

    const thumbBuffer = await generateThumbnailInside(fileBuffer, 480);
    const thumbKey = await storage.uploadFile({
      fileContent: thumbBuffer,
      fileName: `library_${Date.now()}_${fileName}_thumb.jpg`,
      contentType: 'image/jpeg',
    });
    const thumbnailUrl = await storage.generatePresignedUrl({ key: thumbKey, expireTime: 604800 });

    const title = (formData.get('title') as string) || fileName;
    const tagsRaw = (formData.get('tags') as string) || '';
    const tags = tagsRaw
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
      .slice(0, 20);

    const created = await libraryAssetManager.createAsset({
      type: 'image',
      source: 'upload',
      title,
      tags,
      mimeType,
      size: fileBuffer.byteLength,
      url,
      storageKey: originalKey,
      thumbnailUrl,
      thumbnailStorageKey: thumbKey,
    });

    console.info('[content-library/assets/upload] ok', { id: created.id, type: created.type, source: created.source });
    return NextResponse.json({ success: true, data: created });
  } catch (error) {
    console.error('[content-library/assets/upload] failed:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
