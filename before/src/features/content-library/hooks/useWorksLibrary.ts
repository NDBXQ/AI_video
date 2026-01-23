'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Story } from '../domain/types';

export function useWorksLibrary() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadStories = async () => {
      try {
        const res = await fetch('/api/stories');
        const data = await res.json();
        if (cancelled) return;

        if (data?.success) {
          setStories(data.data || []);
          return;
        }

        setStories([]);
        console.error('加载作品失败: API 返回异常', data);
      } catch (error) {
        if (cancelled) return;
        console.error('加载作品失败:', error);
        setStories([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadStories();

    return () => {
      cancelled = true;
    };
  }, []);

  const drafts = useMemo(
    () => stories.filter((s) => s.progressStage !== 'completed'),
    [stories]
  );
  const completed = useMemo(
    () => stories.filter((s) => s.progressStage === 'completed'),
    [stories]
  );

  return { stories, drafts, completed, loading };
}

