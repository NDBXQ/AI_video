// 用户类型
export interface User {
  id: string;
  username: string;
  phone?: string;
  email?: string;
  role: 'user' | 'admin';
  status: 'normal' | 'disabled';
  createdAt: string;
  lastLoginAt?: string;
}

// 分镜脚本类型
export interface StoryboardScript {
  id: string;
  title: string;
  type: 'story' | 'summary';
  content: string;
  scenes: Scene[];
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'completed';
}

export interface Scene {
  id: string;
  order: number;
  shotType: string;
  content: string;
  duration?: number;
  camera?: string;
}

// 图片类型
export interface Image {
  id: string;
  url: string;
  prompt: string;
  tags: string[];
  scriptId?: string;
  sceneId?: string;
  createdAt: string;
  status: 'generating' | 'completed' | 'failed';
}

// 视频类型
export interface Video {
  id: string;
  title: string;
  scriptId: string;
  imageIds: string[];
  audioConfig: AudioConfig;
  effectConfig: EffectConfig;
  videoUrl?: string;
  status: 'draft' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export interface AudioConfig {
  voice: string;
  speed: number;
  emotion: string;
  bgm?: string;
}

export interface EffectConfig {
  transition?: string;
  subtitle?: string;
}

// API Token 类型
export interface ApiToken {
  id: string;
  token: string;
  userId: string;
  username: string;
  permissions: string[];
  createdAt: string;
  expiresAt: string;
  status: 'active' | 'expired' | 'revoked';
  lastUsedAt?: string;
}

// 操作日志类型
export interface OperationLog {
  id: string;
  operator: string;
  operatorId: string;
  operationType: string;
  target: string;
  result: 'success' | 'failed';
  timestamp: string;
  details?: string;
}

// Token使用日志类型
export interface TokenUsageLog {
  id: string;
  tokenId: string;
  tokenMasked: string;
  apiEndpoint: string;
  parameters?: string;
  result: 'success' | 'failed' | 'error';
  ip: string;
  timestamp: string;
}

// 公共资源库素材类型
export interface PublicResource {
  id: string;
  type: 'character' | 'background' | 'props' | 'music' | 'effect' | 'transition';
  name: string;
  description: string;
  previewUrl: string;
  originalUrl?: string;
  tags: string[];
  applicableScenes: string[];
}
