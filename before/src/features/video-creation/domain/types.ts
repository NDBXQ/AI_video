/**
 * 视频创作领域类型定义
 */

// 分镜脚本数据（StoryboardScript）
export interface ScriptData {
  id: string;
  sequence: number;
  scriptContent: string;
  imageUrl?: string;
}

// 分镜文本数据（StoryboardText）
export interface StoryboardTextData {
  id: string;
  sequence: number;
  sceneTitle: string;
  originalText: string;
  storyboardText: string;
  shotCut: boolean;
  scripts: ScriptData[];
}

// 大纲数据（Outline）
export interface OutlineData {
  id: string;
  sequence: number;
  outlineText: string;
  originalText: string;
  storyboardTexts?: StoryboardTextData[];
}

// 故事信息（Story）
export interface Story {
  id: string;
  storyId: string;
  title: string;
  duration: number; // 总时长（秒）
  sceneCount: number; // 分镜数量
  createdAt: string;
  storyText?: string;
  outlines?: OutlineData[];
}

// 参考图类型
export interface ReferenceImage {
  id: string;
  name: string; // item_name、role_name、background_name
  url: string; // 原图URL
  category: 'item' | 'role' | 'background';
  storageKey?: string; // 对象存储的key，用于后续管理
  thumbnailUrl?: string; // 缩略图URL
  thumbnailStorageKey?: string; // 缩略图对象存储的key
  description?: string;
}

// 描述信息（带类别）
export interface DescriptionWithCategory {
  text: string;
  category: 'background' | 'role' | 'item';
  name: string; // 图片名称
}

// 分镜信息（Scene）
export interface Scene {
  id: string;
  storyId: string; // 故事ID
  storyboardTextId: string; // 分镜文本ID（外键，用于存储脚本）
  sequence: number; // 序号
  title: string;
  content: string; // 分镜内容描述
  duration: number; // 时长（秒）
  thumbnail: string; // 缩略图URL
  audio?: string;
  subtitle?: string;
  // 参考图列表
  referenceImages?: ReferenceImage[];
  // 合成图
  composedImage?: string;
  // 合成视频
  composedVideo?: string;
  // 合成音频
  composedAudio?: string;
  // 分镜脚本生成状态
  scriptGenerated?: boolean; // 是否已生成分镜脚本
  scriptGenerating?: boolean; // 是否正在生成分镜脚本
  generatedScript?: any; // 生成的分镜脚本数据
  // 视频生成提示词（从数据库prompts表获取）
  videoPrompt?: string;
  imagePromptType?: '首帧' | '尾帧';
  // 镜头切换
  shot_cut?: boolean; // 是否为镜头切换点
  // 参考图生成状态
  hasReferenceImages?: boolean; // 是否已生成参考图
  // 视频生成状态
  isVideoGenerated?: boolean; // 是否已生成视频
}

// 音频配置
export interface AudioConfig {
  voice: VoiceType;
  speed: number; // 0.5 - 2.0
  bgm: BackgroundMusicType;
  volume: number; // 0 - 100
}

// 特效配置
export interface EffectConfig {
  transition: TransitionType;
  subtitle: SubtitleType;
  filter: FilterType;
}

// 导出配置
export interface ExportConfig {
  resolution: ResolutionType;
  frameRate: FrameRateType;
  format: VideoFormatType;
}

// 视频合成状态
export type SynthesisStatus = 'idle' | 'synthesizing' | 'completed' | 'failed';

// 枚举类型
export type VoiceType =
  | '温柔女声'
  | '沉稳男声'
  | '活泼少年'
  | '慈祥老人';

export type BackgroundMusicType =
  | '轻快钢琴曲'
  | '科幻电子乐'
  | '古典交响乐'
  | '流行摇滚';

export type TransitionType =
  | '淡入淡出'
  | '左滑右滑'
  | '放大缩小'
  | '旋转'
  | '无';

export type SubtitleType =
  | '中文字幕'
  | '英文字幕'
  | '双语字幕'
  | '无字幕';

export type FilterType =
  | '无'
  | '暖色调'
  | '冷色调'
  | '复古'
  | '黑白';

export type ResolutionType = '1080p' | '720p' | '480p';

export type FrameRateType = '30' | '24' | '60';

export type VideoFormatType = 'mp4' | 'mov' | 'webm';

// 播放控制状态
export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  totalDuration: number;
}

// 选择状态
export interface SelectionState {
  selectedStoryId: string | null;
  selectedStoryboardId: string | null;
}

// API响应类型
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

export type StoryListResponse = Story[];

export interface StoryDetailResponse {
  story: Story;
  scenes: Scene[];
}

// 时间线视频数据
export interface TimelineVideoData {
  storyboardId: string;
  sceneTitle: string;
  sequence: number;
  video?: {
    url: string;
    mode: '首帧' | '尾帧';
    duration: number;
    thumbnailUrl?: string;
    createdAt: string;
  };
}
