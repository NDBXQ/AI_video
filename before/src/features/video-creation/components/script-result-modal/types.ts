// 实际API返回的数据结构
export interface VideoScriptData {
  shot?: {
    shot_duration?: number | string | any;
    cut_to?: boolean;
    shot_style?: string | number | any;
  };
  shot_content?: {
    background?: {
      background_name?: string | number | any;
      status?: string | number | any;
    };
    roles?: Array<{
      role_name?: string | number | any;
      appearance_time_point?: number;
      location_info?: string | number | any;
      action?: string | number | any;
      expression?: string | number | any;
      speak?: {
        time_point?: number;
        tone?: string | number | any;
        content?: string | number | any;
        speed?: number;
        emotion?: string | number | any;
      };
    }>;
    role_items?: (string | { item_name?: string; description?: string; [key: string]: any })[];
    other_items?: (string | { item_name?: string; description?: string; [key: string]: any })[];
    shoot?: {
      shot_angle?: string | number | any;
      angle?: string | number | any;
      camera_movement?: string | number | any;
    };
    bgm?: string | number | any;
  };
  video_content?: {
    background?: {
      background_name?: string | number | any;
      description?: string | number | any;
    };
    roles?: Array<{
      role_name?: string | number | any;
      description?: string | number | any;
    }>;
    items?: Array<{
      item_name?: string | number | any;
      description?: string | number | any;
      relation?: string | number | any;
    }>;
    other_items?: (string | { item_name?: string; description?: string; [key: string]: any })[];
  };
}

/**
 * 解析脚本数据，提取 shot、shot_content、video_content
 * @param {any} data - API 返回的原始脚本数据
 * @returns {VideoScriptData | null} 解析后的结构化脚本数据
 */
export function parseScriptData(data: any): VideoScriptData | null {
  // 处理Coze API返回的包装结构 { video_script: { ... } }
  let actualData: Record<string, any> = data;
  if (data && typeof data === 'object' && data.video_script && typeof data.video_script === 'object') {
    actualData = data.video_script as Record<string, any>;
  }

  // 如果actualData是字符串，尝试解析
  if (typeof actualData === 'string') {
    try {
      actualData = JSON.parse(actualData) as Record<string, any>;
    } catch (e) {
      console.error('解析JSON字符串失败:', e);
      return null;
    }
  }

  if (!actualData || typeof actualData !== 'object') return null;

  const shotData = actualData.shot ?? actualData.shot_info ?? actualData.shotInfo ?? {};

  // 直接提取三个主要字段
  return {
    shot: shotData,
    shot_content: actualData.shot_content || {},
    video_content: actualData.video_content || {},
  };
}
