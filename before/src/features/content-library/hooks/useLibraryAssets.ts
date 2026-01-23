'use client';

import { useEffect, useMemo, useState } from 'react';

export type LibraryAsset = {
  id: string;
  type: 'image' | 'video' | 'audio';
  source: 'upload' | 'ai';
  title: string | null;
  prompt: string | null;
  tags: string[];
  mimeType: string | null;
  size: number | null;
  url: string;
  storageKey: string;
  thumbnailUrl: string | null;
  thumbnailStorageKey: string | null;
  createdAt: string;
};

export function useLibraryAssets(params: {
  type: 'image' | 'video' | 'audio';
  search: string;
  sort: 'recent' | 'oldest' | 'title';
  limit?: number;
  enabled: boolean;
}) {
  const { type, search, sort, limit, enabled } = params;
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<LibraryAsset[]>([]);
  const [total, setTotal] = useState(0);

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set('type', type);
    if (search.trim().length > 0) sp.set('search', search.trim());
    sp.set('sort', sort);
    if (typeof limit === 'number') sp.set('limit', String(limit));
    return sp.toString();
  }, [type, search, sort, limit]);

  const reload = async () => {
    if (!enabled) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/content-library/assets?${query}`);
      const data = await res.json();
      if (data?.success) {
        setItems(data.data || []);
        setTotal(typeof data.total === 'number' ? data.total : 0);
        return;
      }
      console.error('[useLibraryAssets] load failed:', data);
      setItems([]);
      setTotal(0);
    } catch (error) {
      console.error('[useLibraryAssets] load failed:', error);
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
