import { NextRequest, NextResponse } from 'next/server';
import { generatedImageManager } from '@/storage/database/generatedImageManager';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('[test-insert-generated-image] 开始测试插入，body:', body);

    const image = await generatedImageManager.createGeneratedImage({
      storyId: body.storyId,
      name: body.name,
      description: body.description,
      url: body.url,
      storageKey: body.storageKey,
      category: body.category,
    });

    console.log('[test-insert-generated-image] 插入成功, id:', image.id);

    return NextResponse.json({
      success: true,
      data: image,
      message: '插入成功',
    });
  } catch (error) {
    console.error('[test-insert-generated-image] 插入失败:', error);
    console.error('[test-insert-generated-image] 错误详情:', error instanceof Error ? error.message : String(error));
    console.error('[test-insert-generated-image] 错误堆栈:', error instanceof Error ? error.stack : 'No stack');

    return NextResponse.json(
      {
        success: false,
        message: `插入失败: ${error instanceof Error ? error.message : '未知错误'}`,
        error: String(error),
      },
      { status: 500 }
    );
  }
}
