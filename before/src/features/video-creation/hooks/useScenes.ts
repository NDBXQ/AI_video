/**
 * useScenes Hook - 管理分镜列表
 */

import { useState, useCallback } from 'react';
import { Scene, Story } from '../domain/types';
import { StoryService } from '../services';

interface LoadScenesParams {
  storyId?: string;
  outlineId?: string;
}

export function useScenes() {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStory, setCurrentStory] = useState<Story | null>(null);

  // 加载分镜列表
  const loadScenes = useCallback(async (params: LoadScenesParams | string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      let data: Scene[] = [];

      // 兼容旧的调用方式 (只传 storyId 字符串)
      if (typeof params === 'string') {
        const result = await StoryService.fetchStoryDetail(params);
        if (result) {
          setCurrentStory(result.story);
          data = result.scenes;
        }
      } 
      // 新的调用方式 (对象参数)
      else {
        if (params.outlineId) {
          data = await StoryService.fetchOutlineScenes(params.outlineId);
          // 按Outline加载时，置空currentStory避免状态不一致
          setCurrentStory(null);
        } else if (params.storyId) {
          const result = await StoryService.fetchStoryDetail(params.storyId);
          if (result) {
            setCurrentStory(result.story);
            data = result.scenes;
          }
        }
      }

      setScenes(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载分镜失败';
      setError(message);
      setScenes([]);
      setCurrentStory(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // 更新单个分镜的状态（辅助方法，避免直接操作整个列表）
  const updateScene = useCallback((sceneId: string, updates: Partial<Scene>) => {
    setScenes(prev => prev.map(scene => 
      scene.id === sceneId ? { ...scene, ...updates } : scene
    ));
  }, []);

  // 清空分镜
  const clearScenes = useCallback(() => {
    setScenes([]);
    setCurrentStory(null);
    setError(null);
  }, []);

  return {
    scenes,
    loading,
    error,
    currentStory,
    loadScenes,
    setScenes, // 仍然暴露以支持批量更新等复杂操作
    updateScene, // 新增：更安全的单体更新方法
    clearScenes,
  };
}

export type UseScenesReturn = ReturnType<typeof useScenes>;
