import { NextRequest, NextResponse } from 'next/server';
import { publicResourceManager } from '@/storage/database';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = (searchParams.get('type') || 'all') as
      | 'all'
      | 'character'
      | 'background'
      | 'props'
      | 'music'
      | 'effect'
      | 'transition';
    const search = searchParams.get('search') || undefined;
    const sort = (searchParams.get('sort') || 'recent') as 'recent' | 'oldest' | 'title';
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined;
    const offset = searchParams.get('offset') ? Number(searchParams.get('offset')) : undefined;

    if (!['all', 'character', 'background', 'props', 'music', 'effect', 'transition'].includes(type)) {
      return NextResponse.json({ success: false, message: 'type 参数无效' }, { status: 400 });
    }

    if (!['recent', 'oldest', 'title'].includes(sort)) {
      return NextResponse.json({ success: false, message: 'sort 参数无效' }, { status: 400 });
    }

    const result = await publicResourceManager.listResources({ type, search, sort, limit, offset });
    return NextResponse.json({ success: true, data: result.items, total: result.total });
  } catch (error) {
    console.error('[content-library/public-resources] GET failed:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const ids = Array.isArray(body?.ids) ? body.ids : [];
    const safeIds = ids.map((id: any) => String(id)).filter(Boolean);
    const result = await publicResourceManager.deleteResources(safeIds);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[content-library/public-resources] DELETE failed:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
