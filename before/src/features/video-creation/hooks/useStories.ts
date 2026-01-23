/**
 * useStories Hook - 管理故事列表
 */

import { useState, useEffect } from 'react';
import { Story } from '../domain/types';
import { StoryService } from '../services';

export function useStories(storyId?: string | null) {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 加载故事列表
  useEffect(() => {
    const loadStories = async () => {
      try {
        console.log('[useStories] 开始加载故事... storyId:', storyId);
        setLoading(true);
        setError(null);
        const data = await StoryService.fetchStories(storyId);
        console.log('[useStories] 加载完成，获得', data.length, '个故事');
        setStories(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : '加载失败';
        console.error('[useStories] 加载失败:', err);
        setError(message);
        setStories([]);
      } finally {
        console.log('[useStories] 加载状态结束，loading设为false');
        setLoading(false);
      }
    };

    loadStories();
  }, [storyId]);

  return {
    stories,
    loading,
    error,
    refetch: () => {
      setLoading(true);
      StoryService.fetchStories(storyId)
        .then(setStories)
        .catch((err) => {
          setError(err instanceof Error ? err.message : '加载失败');
        })
        .finally(() => setLoading(false));
    },
  };
}

export type UseStoriesReturn = ReturnType<typeof useStories>;
