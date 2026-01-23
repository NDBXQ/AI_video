/**
 * PromptGenerationService - 提示词生成服务
 * 调用提示词生成API，生成分镜脚本的提示词
 */

export interface GeneratePromptsResponse {
  success: boolean;
  message?: string;
  data?: {
    video_prompt?: string;
    image_prompt_type?: string;
    image_prompt?: string;
    run_id?: string;
    [key: string]: any;
  };
}

/**
 * 生成提示词
 * @param scriptJson 分镜脚本JSON数据
 * @returns 提示词生成结果
 */
export async function generatePrompts(
  scriptJson: any
): Promise<GeneratePromptsResponse> {
  try {
    console.log('[PromptGenerationService] 开始生成提示词...');
    console.log('[PromptGenerationService] script_json:', JSON.stringify(scriptJson, null, 2));

    const response = await fetch('/api/video-creation/prompts/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        script_json: scriptJson,
      }),
    });

    console.log('[PromptGenerationService] 响应状态:', response.status);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[PromptGenerationService] 生成提示词失败:', errorData);
      return {
        success: false,
        message: errorData.message || `请求失败: ${response.status}`,
      };
    }

    const result: GeneratePromptsResponse = await response.json();
    console.log('[PromptGenerationService] 生成提示词成功:', result);

    return result;
  } catch (error) {
    console.error('[PromptGenerationService] 生成提示词异常:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return {
      success: false,
      message: `生成提示词失败: ${errorMessage}`,
    };
  }
}

/**
 * 导出服务
 */
export const promptGenerationService = {
  generatePrompts,
};
