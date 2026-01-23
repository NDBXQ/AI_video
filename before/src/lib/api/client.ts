// API配置 - 使用Next.js API路由作为代理
const API_BASE_URL = ''; // 使用相对路径，调用Next.js API路由

export interface StoryboardTextRequest {
  input_type: string;
  story_text: string;
}

export interface StoryboardTextResponse {
  success: boolean;
  data?: any;
  message: string;
}

export interface StoryboardScriptRequest {
  storyboard_text: string;
}

export interface StoryboardScriptResponse {
  success: boolean;
  data?: any;
  message: string;
}

/**
 * API客户端类
 */
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API请求失败:', error);
      throw error;
    }
  }

  /**
   * 生成分镜文本
   */
  async generateStoryboardText(
    request: StoryboardTextRequest
  ): Promise<StoryboardTextResponse> {
    return this.request<StoryboardTextResponse>(
      '/api/storyboard/generate-text',
      {
        method: 'POST',
        body: JSON.stringify(request),
      }
    );
  }

  /**
   * 生成分镜脚本
   */
  async generateStoryboardScript(
    request: StoryboardScriptRequest
  ): Promise<StoryboardScriptResponse> {
    return this.request<StoryboardScriptResponse>(
      '/api/storyboard/generate-script',
      {
        method: 'POST',
        body: JSON.stringify(request),
      }
    );
  }
}

// 导出单例实例
export const apiClient = new ApiClient();
