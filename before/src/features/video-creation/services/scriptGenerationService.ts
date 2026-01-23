/**
 * 脚本生成服务 - 调用分镜脚本生成接口
 */

interface GenerateScriptRequest {
  raw_script: string;
  demand: string;
}

interface GenerateScriptResponse {
  success: boolean;
  data?: any;
  message?: string;
}

interface SceneToGenerate {
  id: string;
  content: string;
  storyboardTextId: string;
  sequence: number;
}

interface GenerateBatchScriptsOptions {
  concurrency?: number;
}

interface StoreScriptRequest {
  storyboardTextId: string;
  sequence: number;
  scriptContent: object;
  imageUrl?: string;
}

interface StoreScriptResponse {
  success: boolean;
  data?: any;
  message?: string;
  debugInfo?: {
    storyboardTextId: string;
    sequence: number;
    asyncPromptGeneration: {
      started: boolean;
      sceneId: string;
      note: string;
    };
  };
}

export class ScriptGenerationService {
  private apiBaseUrl: string;

  constructor() {
    this.apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || '';
  }

  /**
   * 生成分镜脚本
   * @param rawScript 分镜文本
   * @param demand 用户需求
   */
  async generateScript(
    rawScript: string,
    demand: string
  ): Promise<GenerateScriptResponse> {
    try {
      console.log('[scriptGenerationService] 准备调用generateScript');
      console.log('[scriptGenerationService] - rawScript长度:', rawScript.length);
      console.log('[scriptGenerationService] - demand长度:', demand.length);
      console.log('[scriptGenerationService] - rawScript前100字符:', rawScript.substring(0, 100));

      const response = await fetch('/api/coze/generate-script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          raw_script: rawScript,
          demand: demand,
        }),
      });

      console.log('[scriptGenerationService] 响应状态:', response.status, response.statusText);
      console.log('[scriptGenerationService] 响应类型:', response.type);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[scriptGenerationService] 响应错误内容:', errorText);

        // 尝试解析错误信息
        let errorMessage = `API调用失败: ${response.status}`;
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.message) {
            errorMessage = errorJson.message;
          }
          if (errorJson.details) {
            console.error('[scriptGenerationService] 错误详情:', errorJson.details);
          }
        } catch (e) {
          // 无法解析为JSON
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('[scriptGenerationService] 返回数据 success:', data.success);
      console.log('[scriptGenerationService] 返回的 run_id:', data.data?.run_id);
      console.log('[scriptGenerationService] 返回的 video_script 关键信息:', {
        shot: data.data?.video_script?.shot,
        shotContentBackground: data.data?.video_script?.shot_content?.background?.background_name,
      });
      return data;
    } catch (error) {
      console.error('[scriptGenerationService] 生成分镜脚本失败:', error);
      throw error;
    }
  }

  /**
   * 存储分镜脚本到数据库
   * @param storyboardTextId 分镜文本ID（外键）
   * @param sequence 序号
   * @param scriptContent 脚本内容（对象）
   * @param imageUrl 图片URL（可选）
   */
  async storeScript(
    storyboardTextId: string,
    sequence: number,
    scriptContent: object,
    imageUrl?: string
  ): Promise<StoreScriptResponse> {
    try {
      console.log('[scriptGenerationService] 准备存储脚本:', {
        storyboardTextId,
        sequence,
        scriptContentType: typeof scriptContent,
        hasImageUrl: !!imageUrl
      });

      const response = await fetch('/api/video-creation/scripts/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          storyboardTextId,
          sequence,
          scriptContent,
          imageUrl,
        }),
      });

      console.log('[scriptGenerationService] 存储脚本响应状态:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[scriptGenerationService] 存储脚本失败:', {
          status: response.status,
          errorText
        });
        throw new Error(`存储脚本失败: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log('[scriptGenerationService] 存储脚本成功:', data);
      if (data.debugInfo) {
        console.log('[scriptGenerationService] 调试信息:', data.debugInfo);
        console.log('[scriptGenerationService] 提示词生成状态:', data.debugInfo.asyncPromptGeneration);
      }
      return data;
    } catch (error) {
      console.error('[scriptGenerationService] 存储分镜脚本失败:', error);
      throw error;
    }
  }

  /**
   * 批量生成分镜脚本
   * @param scenes 分镜列表（包含storyboardTextId和sequence）
   * @param demand 用户需求
   * @param onProgress 进度回调 (当前索引, 总数, sceneId, result)
   */
  async generateBatchScripts(
    scenes: SceneToGenerate[],
    demand: string,
    onProgress?: (currentIndex: number, total: number, sceneId: string, result: any) => void,
    options?: GenerateBatchScriptsOptions
  ): Promise<Map<string, any>> {
    const results = new Map<string, any>();
    const total = scenes.length;
    const concurrency =
      typeof options?.concurrency === 'number' && Number.isFinite(options.concurrency) && options.concurrency > 0
        ? Math.floor(options.concurrency)
        : 5;

    console.log(`[generateBatchScripts] 开始批量生成, 总数: ${total}`);
    console.log(`[generateBatchScripts] demand:`, demand);

    console.log(`[generateBatchScripts] 并发度: ${concurrency}`);

    const nextIndexRef = { value: 0 };
    let completedCount = 0;

    const runOne = async (scene: SceneToGenerate) => {
      try {
        console.log(`[generateBatchScripts] 开始处理分镜`);
        console.log(`[generateBatchScripts] - 分镜ID: ${scene.id}`);
        console.log(`[generateBatchScripts] - storyboardTextId: ${scene.storyboardTextId}`);
        console.log(`[generateBatchScripts] - sequence: ${scene.sequence}`);
        console.log(`[generateBatchScripts] - content前100字符: ${scene.content.substring(0, 100)}`);

        const generateResult = await this.generateScript(scene.content, demand);

        if (generateResult.success && generateResult.data) {
          if (generateResult.data.video_script?.error) {
            console.warn(
              `[generateBatchScripts] 分镜 ${scene.id} 生成包含业务错误:`,
              generateResult.data.video_script.error
            );
          }

          const storeResult = await this.storeScript(
            scene.storyboardTextId,
            scene.sequence,
            generateResult.data,
            undefined
          );

          if (storeResult.success && storeResult.data) {
            console.log(
              `[generateBatchScripts] 分镜 ${scene.id} 存储成功, 提示词生成状态:`,
              storeResult.debugInfo?.asyncPromptGeneration
            );
            results.set(scene.id, generateResult.data);
            if (onProgress) {
              completedCount += 1;
              onProgress(completedCount, total, scene.id, generateResult.data);
            } else {
              completedCount += 1;
            }
            return;
          }

          console.error(`存储脚本失败 (分镜ID: ${scene.id}):`, storeResult.message);
          if (onProgress) {
            completedCount += 1;
            onProgress(completedCount, total, scene.id, null);
          } else {
            completedCount += 1;
          }
          return;
        }

        console.error(`[generateBatchScripts] 分镜 ${scene.id} 生成失败，无数据返回`);
        if (onProgress) {
          completedCount += 1;
          onProgress(completedCount, total, scene.id, null);
        } else {
          completedCount += 1;
        }
      } catch (error) {
        console.error(`[generateBatchScripts] 生成脚本失败 (分镜ID: ${scene.id}):`, error);
        if (onProgress) {
          completedCount += 1;
          onProgress(completedCount, total, scene.id, null);
        } else {
          completedCount += 1;
        }
      }
    };

    const worker = async () => {
      while (true) {
        const index = nextIndexRef.value;
        if (index >= scenes.length) return;
        nextIndexRef.value += 1;
        const scene = scenes[index];
        await runOne(scene);
      }
    };

    const workerCount = Math.min(concurrency, scenes.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));

    console.log(`[generateBatchScripts] 批量生成完成, 成功: ${results.size}/${total}`);
    return results;
  }
}

// 单例导出
export const scriptGenerationService = new ScriptGenerationService();
