/**
 * 分镜文本页面的工具函数
 */

import {
  ERROR_MESSAGES,
  GENERATING_TIME_PER_SCENE,
  URL_DATA_SIZE_WARNING_THRESHOLD,
} from './constants';
import type { GeneratingProgress } from './types';

// 重新导出常量
export { GENERATING_TIME_PER_SCENE };

/**
 * 解析分镜文本，处理JSON格式
 */
export function parseStoryboardText(storyboardText: string | any): string {
  if (typeof storyboardText !== 'string') {
    return String(storyboardText);
  }

  try {
    const parsed = JSON.parse(storyboardText);
    return parsed.storyboard_text || storyboardText;
  } catch {
    return storyboardText;
  }
}

/**
 * 构建分镜文本内容（用于概览显示）
 */
export function buildGeneratedTextContent(results: any[]): string {
  let generatedTextContent = '';

  results.forEach((result, index) => {
    const sceneNum = index + 1;
    generatedTextContent += `【场景${sceneNum}】\n`;

    if (result.outline) {
      generatedTextContent += `大纲：${result.outline}\n`;
    }

    if (result.original) {
      generatedTextContent += `原文：${result.original}\n`;
    }

    if (result.storyboardText) {
      const textContent = parseStoryboardText(result.storyboardText);
      generatedTextContent += `分镜文本：${textContent}\n\n`;
    } else {
      generatedTextContent += `分镜文本：生成失败 - ${result.error}\n\n`;
    }
  });

  return generatedTextContent;
}

/**
 * 计算预计剩余时间
 */
export function calculateEstimatedTime(progress: GeneratingProgress): number {
  const remainingScenes = progress.total - progress.completed;
  return Math.max(0, remainingScenes * GENERATING_TIME_PER_SCENE);
}

/**
 * 检查错误信息并返回用户友好的错误提示
 */
export function getErrorMessage(error: unknown): string {
  const errorMsg = error instanceof Error ? error.message : '未知错误';

  if (errorMsg.includes('504') || errorMsg.includes('超时')) {
    return ERROR_MESSAGES.TIMEOUT;
  } else if (errorMsg.includes('500')) {
    return ERROR_MESSAGES.SERVER_ERROR;
  } else if (errorMsg.includes('Failed to fetch')) {
    return ERROR_MESSAGES.NETWORK_ERROR;
  } else {
    return `${ERROR_MESSAGES.GENERATING}: ${errorMsg}`;
  }
}

/**
 * 检查URL参数大小并给出警告
 */
export function checkURLDataSize(encodedData: string): boolean {
  if (encodedData.length > URL_DATA_SIZE_WARNING_THRESHOLD) {
    console.warn('URL参数过长，可能影响页面加载');
    alert(ERROR_MESSAGES.DATA_TOO_LARGE);
    return true;
  }
  return false;
}

/**
 * 将大纲数据转换为文本显示
 */
export function outlineDataToText(outlineData: any): string {
  let textContent = '';

  if (outlineData.story_text) {
    textContent += `【故事简介】\n${outlineData.story_text}\n\n`;
  }

  if (outlineData.outline_original_list && Array.isArray(outlineData.outline_original_list)) {
    textContent += `【故事大纲】\n`;
    outlineData.outline_original_list.forEach((item: any, index: number) => {
      textContent += `\n【场景${index + 1}】\n${item.outline}\n${item.original}\n`;
    });
  }

  return textContent;
}

/**
 * 检查是否已生成分镜文本
 */
export function hasGeneratedStoryboard(outlineData: any): boolean {
  return (
    outlineData?.outline_original_list?.some(
      (item: any) =>
        (Array.isArray(item.storyboardTexts) && item.storyboardTexts.length > 0) ||
        (typeof item.storyboardText === 'string' && item.storyboardText.length > 0)
    ) || false
  );
}
