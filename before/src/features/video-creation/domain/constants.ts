/**
 * 视频创作领域常量定义
 */

import {
  VoiceType,
  BackgroundMusicType,
  TransitionType,
  SubtitleType,
  FilterType,
  ResolutionType,
  FrameRateType,
  VideoFormatType,
} from './types';

// 默认配置
export const DEFAULT_AUDIO_CONFIG = {
  voice: '温柔女声' as VoiceType,
  speed: 1.0,
  bgm: '轻快钢琴曲' as BackgroundMusicType,
  volume: 80,
};

export const DEFAULT_EFFECT_CONFIG = {
  transition: '淡入淡出' as TransitionType,
  subtitle: '中文字幕' as SubtitleType,
  filter: '无' as FilterType,
};

export const DEFAULT_EXPORT_CONFIG = {
  resolution: '1080p' as ResolutionType,
  frameRate: '30' as FrameRateType,
  format: 'mp4' as VideoFormatType,
};

// 枚举选项
export const VOICE_OPTIONS: VoiceType[] = [
  '温柔女声',
  '沉稳男声',
  '活泼少年',
  '慈祥老人',
];

export const BGM_OPTIONS: BackgroundMusicType[] = [
  '轻快钢琴曲',
  '科幻电子乐',
  '古典交响乐',
  '流行摇滚',
];

export const TRANSITION_OPTIONS: TransitionType[] = [
  '淡入淡出',
  '左滑右滑',
  '放大缩小',
  '旋转',
  '无',
];

export const SUBTITLE_OPTIONS: SubtitleType[] = [
  '中文字幕',
  '英文字幕',
  '双语字幕',
  '无字幕',
];

export const FILTER_OPTIONS: FilterType[] = [
  '无',
  '暖色调',
  '冷色调',
  '复古',
  '黑白',
];

export const RESOLUTION_OPTIONS: ResolutionType[] = [
  '1080p',
  '720p',
  '480p',
];

export const FRAME_RATE_OPTIONS: FrameRateType[] = ['30', '24', '60'];

export const FORMAT_OPTIONS: VideoFormatType[] = ['mp4', 'mov', 'webm'];

// 播放控制常量
export const PLAYBACK_UPDATE_INTERVAL = 100; // ms

// 合成模拟常量
export const SYNTHESIS_PROGRESS_INTERVAL = 100; // ms
export const SYNTHESIS_PROGRESS_STEP = 2; // percent

// 时间线显示
export const TIMELINE_SCENE_WIDTH_FACTOR = 8; // 每秒占8px
export const TIMELINE_SCENE_HEIGHT = 80; // px

// 占位图URL（用于没有缩略图的情况）
export const PLACEHOLDER_THUMBNAIL = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTIiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjE2IiBoZWlnaHQ9IjEyIiBmaWxsPSIjZTVlN2ViIi8+PC9zdmc+';
