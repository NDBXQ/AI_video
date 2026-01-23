import { NextRequest, NextResponse } from 'next/server';

/**
 * 调试端点：记录接收到的参数
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('📝 调试端点收到参数:', JSON.stringify(body, null, 2));

    return NextResponse.json({
      success: true,
      receivedData: body,
      hasOutlineId: !!body.outlineId,
      hasSequence: body.sequence !== undefined,
      outlineId: body.outlineId,
      sequence: body.sequence,
      outline: body.outline,
      original: body.original,
    });
  } catch (error) {
    console.error('调试端点错误:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    );
  }
}
