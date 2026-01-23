import { NextResponse } from 'next/server';
import { storyboardScriptManager } from '@/storage/database/storyboardScriptManager';

/**
 * 清理测试脚本数据
 */
export async function POST() {
  try {
    // 删除测试脚本（scriptContent为"test script content"的记录）
    // 先查询所有脚本
    const db = await (await import('coze-coding-dev-sdk')).getDb();
    const { storyboardScripts } = await import('@/storage/database/shared/schema');

    // 查询所有脚本
    const allScripts = await db.select().from(storyboardScripts);
    console.log('当前脚本总数:', allScripts.length);

    // 找到测试数据
    const testScripts = allScripts.filter(script => script.scriptContent === 'test script content');
    console.log('找到测试脚本数量:', testScripts.length);

    let deletedCount = 0;
    for (const testScript of testScripts) {
      await storyboardScriptManager.deleteStoryboardScript(testScript.id);
      console.log('已删除测试脚本:', testScript.id);
      deletedCount++;
    }

    return NextResponse.json({
      success: true,
      message: `已删除 ${deletedCount} 条测试脚本数据`,
      deletedCount,
    });
  } catch (error) {
    console.error('清理测试脚本失败:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
