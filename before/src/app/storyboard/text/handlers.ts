/**
 * 分镜文本页面的事件处理函数
 */

import { apiClient } from '@/lib/api/client';
import { outlineDataToText, checkURLDataSize } from './utils';
import { ERROR_MESSAGES } from './constants';
import type { OutlineData, StoryboardText } from './types';

/**
 * 生成分镜文本的处理函数
 */
export async function handleGenerate(
  inputType: 'original' | 'brief',
  content: string,
  setGeneratedText: (data: any) => void,
  setStep: (step: 'input' | 'preview') => void,
  setIsGenerating: (isGenerating: boolean) => void
) {
  if (!content.trim()) return;

  setIsGenerating(true);
  setStep('input');

  try {
    const response = await apiClient.generateStoryboardText({
      input_type: inputType,
      story_text: content,
    });

    if (response.success && response.data) {
      const data = response.data;
      let generatedTextContent = '';

      if (data.outline_original_list && Array.isArray(data.outline_original_list)) {
        generatedTextContent = data.outline_original_list
          .map((item: any, index: number) => {
            return `【场景${index + 1}】\n${item.outline}\n${item.original}`;
          })
          .join('\n\n');
      } else if (data.story_text) {
        generatedTextContent = data.story_text;
      } else {
        generatedTextContent = JSON.stringify(data, null, 2);
      }

      const newGeneratedText: StoryboardText = {
        id: `t${Date.now()}`,
        title: content.slice(0, 20) + '...',
        type: inputType,
        content,
        generatedText: generatedTextContent,
        createdAt: new Date().toISOString(),
      };

      setGeneratedText(newGeneratedText);
      setStep('preview');
    } else {
      throw new Error(response.message || '生成失败');
    }
  } catch (error) {
    console.error('生成分镜文本失败:', error);
    let errorMessage = '生成失败，请稍后重试';
    const errorMsg = error instanceof Error ? error.message : '未知错误';

    if (errorMsg.includes('504') || errorMsg.includes('超时')) {
      errorMessage = ERROR_MESSAGES.TIMEOUT;
    } else if (errorMsg.includes('500')) {
      errorMessage = ERROR_MESSAGES.SERVER_ERROR;
    } else if (errorMsg.includes('Failed to fetch')) {
      errorMessage = ERROR_MESSAGES.NETWORK_ERROR;
    } else {
      errorMessage = `生成失败: ${errorMsg}`;
    }

    alert(errorMessage);
  } finally {
    setIsGenerating(false);
  }
}

/**
 * 清空输入的处理函数
 */
export function handleClear(
  setContent: (content: string) => void,
  setGeneratedText: (data: any) => void,
  setStep: (step: 'input' | 'preview') => void
) {
  setContent('');
  setGeneratedText(null);
  setStep('input');
}

/**
 * 保存草稿的处理函数
 */
export function handleSaveDraft(content: string) {
  // TODO: 实现保存草稿功能
  alert('草稿保存功能开发中...');
}

/**
 * 编辑文本的处理函数
 */
export function handleEditText(
  outlineData: OutlineData | null,
  setStep: (step: 'input' | 'preview') => void
) {
  if (!outlineData) return;

  const textContent = outlineDataToText(outlineData);
  setStep('input');
  // TODO: 将大纲数据填充到输入框
  console.log('切换到编辑模式，文本内容:', textContent);
}

/**
 * 场景选择处理函数
 */
export function handleSceneSelect(index: number, setSelectedSceneIndex: (index: number) => void) {
  setSelectedSceneIndex(index);
}

/**
 * 上一场景处理函数
 */
export function handlePreviousScene(
  selectedSceneIndex: number,
  setSelectedSceneIndex: (index: number) => void
) {
  setSelectedSceneIndex(Math.max(0, selectedSceneIndex - 1));
}

/**
 * 下一场景处理函数
 */
export function handleNextScene(
  selectedSceneIndex: number,
  maxIndex: number,
  setSelectedSceneIndex: (index: number) => void
) {
  setSelectedSceneIndex(Math.min(maxIndex, selectedSceneIndex + 1));
}

/**
 * 取消生成处理函数
 */
export function handleCancelGeneration(setShouldCancel: (cancel: boolean) => void) {
  if (confirm('确定要取消生成吗？已生成的场景将保留。')) {
    setShouldCancel(true);
    alert('正在取消生成...');
  }
}
