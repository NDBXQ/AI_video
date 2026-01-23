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

function extFromMime(mimeType: string) {
  const m = mimeType.toLowerCase();
  if (m.includes('png')) return 'png';
  if (m.includes('webp')) return 'webp';
  if (m.includes('jpeg') || m.includes('jpg')) return 'jpg';
  return 'jpg';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const url = typeof body?.url === 'string' ? body.url : '';
    if (!url) {
      return NextResponse.json({ success: false, message: '缺少 url' }, { status: 400 });
    }

    const type = (body?.type || 'props') as
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

    const response = await fetch(url);
    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: `下载图片失败: ${response.status}` },
        { status: 502 }
      );
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const buffer = Buffer.from(await response.arrayBuffer());

    const rawName = typeof body?.name === 'string' && body.name.trim().length > 0 ? body.name.trim() : 'image';
    const fileNameBase = getSafeFileName(rawName);
    const fileName = fileNameBase.includes('.') ? fileNameBase : `${fileNameBase}.${extFromMime(contentType)}`;

    const storage = createCozeStorage();
    const originalKey = await storage.uploadFile({
      fileContent: buffer,
      fileName: `public_${type}_${Date.now()}_${fileName}`,
      contentType,
    });
    const originalUrl = await storage.generatePresignedUrl({ key: originalKey, expireTime: 604800 });

    const thumbBuffer = await generateThumbnailInside(buffer, 480);
    const thumbKey = await storage.uploadFile({
      fileContent: thumbBuffer,
      fileName: `public_${type}_${Date.now()}_${fileName}_thumb.jpg`,
      contentType: 'image/jpeg',
    });
    const previewUrl = await storage.generatePresignedUrl({ key: thumbKey, expireTime: 604800 });

    const description = typeof body?.description === 'string' ? body.description : '';
    const tags = parseCsv(body?.tags);
    const applicableScenes = parseCsv(body?.applicableScenes);

    const created = await publicResourceManager.createResource({
      type,
      source: 'upload',
      name: rawName,
      description,
      previewUrl,
      previewStorageKey: thumbKey,
      originalUrl,
      originalStorageKey: originalKey,
      tags,
      applicableScenes,
    });

    console.info('[content-library/public-resources/import-by-url] ok', { id: created.id, type: created.type });
    return NextResponse.json({ success: true, data: created });
  } catch (error) {
    console.error('[content-library/public-resources/import-by-url] failed:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

