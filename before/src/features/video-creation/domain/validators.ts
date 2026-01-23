/**
 * 视频创作领域验证逻辑
 */

import {
  AudioConfig,
  EffectConfig,
  Scene,
  Story,
} from './types';
import {
  DEFAULT_AUDIO_CONFIG,
  DEFAULT_EFFECT_CONFIG,
} from './constants';

/**
 * 验证音频配置
 */
export function validateAudioConfig(config: Partial<AudioConfig>): AudioConfig {
  return {
    voice: config.voice ?? DEFAULT_AUDIO_CONFIG.voice,
    speed: Math.max(0.5, Math.min(2.0, config.speed ?? DEFAULT_AUDIO_CONFIG.speed)),
    bgm: config.bgm ?? DEFAULT_AUDIO_CONFIG.bgm,
    volume: Math.max(0, Math.min(100, config.volume ?? DEFAULT_AUDIO_CONFIG.volume)),
  };
}

/**
 * 验证特效配置
 */
export function validateEffectConfig(config: Partial<EffectConfig>): EffectConfig {
  return {
    transition: config.transition ?? DEFAULT_EFFECT_CONFIG.transition,
    subtitle: config.subtitle ?? DEFAULT_EFFECT_CONFIG.subtitle,
    filter: config.filter ?? DEFAULT_EFFECT_CONFIG.filter,
  };
}

/**
 * 验证分镜时长
 */
export function validateSceneDuration(duration: number): boolean {
  return duration > 0 && duration <= 300; // 最多5分钟
}

/**
 * 计算脚本总时长
 */
export function calculateTotalDuration(scenes: Scene[]): number {
  return scenes.reduce((total, scene) => total + scene.duration, 0);
}

/**
 * 验证是否可以开始合成
 */
export function canStartSynthesis(
  selectedScriptId: string | null,
  scenes: Scene[]
): boolean {
  if (!selectedScriptId) {
    return false;
  }
  if (scenes.length === 0) {
    return false;
  }
  return true;
}

/**
 * 获取分镜的起始时间
 */
export function getSceneStartTime(scenes: Scene[], sceneIndex: number): number {
  if (sceneIndex === 0) return 0;
  return scenes.slice(0, sceneIndex).reduce((sum, scene) => sum + scene.duration, 0);
}

/**
 * 判断当前时间是否在某个分镜内
 */
export function isCurrentScene(
  scenes: Scene[],
  sceneIndex: number,
  currentTime: number
): boolean {
  const startTime = getSceneStartTime(scenes, sceneIndex);
  const scene = scenes[sceneIndex];
  return currentTime >= startTime && currentTime < startTime + scene.duration;
}

/**
 * 计算当前分镜的进度
 */
export function calculateSceneProgress(
  scenes: Scene[],
  sceneIndex: number,
  currentTime: number
): number {
  if (!isCurrentScene(scenes, sceneIndex, currentTime)) {
    return 0;
  }
  const startTime = getSceneStartTime(scenes, sceneIndex);
  const scene = scenes[sceneIndex];
  return ((currentTime - startTime) / scene.duration) * 100;
}

/**
 * 格式化时间显示
 */
export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toFixed(1).padStart(4, '0')}`;
}
