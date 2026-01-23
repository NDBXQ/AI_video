'use client';

import { useEffect, useMemo, useState } from 'react';
import type { LibraryStoryboardScript } from '../domain/types';

export function useStoryboardScripts(params: {
  search: string;
  sort: 'recent' | 'oldest' | 'title';
  enabled: boolean;
  limit?: number;
}) {
  const { search, sort, enabled, limit } = params;
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<LibraryStoryboardScript[]>([]);
  const [total, setTotal] = useState(0);

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    if (search.trim().length > 0) sp.set('search', search.trim());
    sp.set('sort', sort);
    if (typeof limit === 'number') sp.set('limit', String(limit));
    return sp.toString();
  }, [search, sort, limit]);

  const reload = async () => {
    if (!enabled) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/content-library/storyboard-scripts?${query}`);
      const data = await res.json();
      if (data?.success) {
        setItems(data.data || []);
        setTotal(typeof data.total === 'number' ? data.total : 0);
        return;
      }
      console.error('[useStoryboardScripts] load failed:', data);
      setItems([]);
      setTotal(0);
    } catch (error) {
      console.error('[useStoryboardScripts] load failed:', error);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, [query, enabled]);

  return { loading, items, total, reload };
}

