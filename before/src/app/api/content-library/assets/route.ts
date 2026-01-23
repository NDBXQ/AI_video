import { NextRequest, NextResponse } from 'next/server';
import { libraryAssetManager } from '@/storage/database';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = (searchParams.get('type') || 'image') as 'image' | 'video' | 'audio';
    const search = searchParams.get('search') || undefined;
    const sort = (searchParams.get('sort') || 'recent') as 'recent' | 'oldest' | 'title';
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined;
    const offset = searchParams.get('offset') ? Number(searchParams.get('offset')) : undefined;

    if (!['image', 'video', 'audio'].includes(type)) {
      return NextResponse.json({ success: false, message: 'type 参数无效' }, { status: 400 });
    }

    if (!['recent', 'oldest', 'title'].includes(sort)) {
      return NextResponse.json({ success: false, message: 'sort 参数无效' }, { status: 400 });
    }

    const result = await libraryAssetManager.listAssets({ type, search, sort, limit, offset });
    return NextResponse.json({ success: true, data: result.items, total: result.total });
  } catch (error) {
    console.error('[content-library/assets] GET failed:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
