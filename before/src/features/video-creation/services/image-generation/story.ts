import { storyboardTextManager } from '@/storage/database/storyboardTextManager';
import { storyOutlineManager } from '@/storage/database/storyOutlineManager';

/**
 * 规范化 storyboardId（兼容展开后的 ${原始ID}-${index} 格式）
 * @param {string} storyboardId - 原始分镜文本 ID
 * @returns {string} 规范化后的分镜文本 ID
 */
export function normalizeStoryboardId(storyboardId: string): string {
  const lastHyphenIndex = storyboardId.lastIndexOf('-');
  if (lastHyphenIndex <= 0) return storyboardId;

  const suffix = storyboardId.substring(lastHyphenIndex + 1);
  if (!/^\d+$/.test(suffix)) return storyboardId;

  return storyboardId.substring(0, lastHyphenIndex);
}

/**
 * 根据 storyboardTextId 查询 storyId
 * @param {string} storyboardTextId - 分镜文本 ID
 * @returns {Promise<string>} storyId
 * @throws {Error} 未找到分镜/大纲时抛出
 */
export async function resolveStoryIdByStoryboardTextId(storyboardTextId: string): Promise<string> {
  const storyboardText = await storyboardTextManager.getStoryboardTextById(storyboardTextId);
  if (!storyboardText) {
    throw new Error('未找到对应的分镜文本');
  }

  const outline = await storyOutlineManager.getOutlineById(storyboardText.outlineId);
  if (!outline) {
    throw new Error('未找到对应的大纲');
  }

  return outline.storyId;
}

