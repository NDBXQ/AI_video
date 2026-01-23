/**
 * 媒体素材库类型定义
 */

// 媒体类型
export type MediaType = 'image' | 'video' | 'audio';

// 媒体素材项
export interface MediaItem {
  id: string;
  type: MediaType;
  title: string;
  url: string;
  thumbnail?: string; // 视频和音频的缩略图
  duration?: number; // 视频和音频的时长（秒）
  size?: string; // 尺寸信息（如 "1920x1080"）
  category?: string; // 分类标签
  tags?: string[]; // 标签
  source: 'upload' | 'generate' | 'library'; // 来源
  generatedFrom?: string; // 如果是生成的，记录来源描述
  liked: boolean;
  createdAt: string;
}

// 媒体筛选器
export interface MediaFilter {
  type: MediaType;
  category?: string;
  tags?: string[];
  source?: 'upload' | 'generate' | 'library' | 'all';
}

// 媒体生成请求
export interface MediaGenerateRequest {
  type: MediaType;
  prompt: string; // 生成提示词
  sceneContext?: string; // 分镜上下文
  style?: string; // 风格要求
}

// 媒体生成结果
export interface MediaGenerateResult {
  id: string;
  type: MediaType;
  url: string;
  thumbnail?: string;
  prompt: string;
}
