'use client';

import { useEffect, useState } from 'react';

export type PublicResourceStats = {
  all: number;
  character: number;
  background: number;
  props: number;
  music: number;
  effect: number;
  transition: number;
};

export function usePublicResourceStats(enabled: boolean) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PublicResourceStats>({
    all: 0,
    character: 0,
    background: 0,
    props: 0,
    music: 0,
    effect: 0,
    transition: 0,
  });

  const reload = async () => {
    if (!enabled) return;
    try {
      setLoading(true);
      const res = await fetch('/api/content-library/public-resources/stats');
      const json = await res.json();
      if (json?.success) {
        setData(json.data);
        return;
      }
      console.error('[usePublicResourceStats] load failed:', json);
    } catch (error) {
      console.error('[usePublicResourceStats] load failed:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, [enabled]);

  return { loading, data, reload };
}

