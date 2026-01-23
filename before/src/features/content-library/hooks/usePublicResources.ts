'use client';

import { useEffect, useMemo, useState } from 'react';
import type { PublicResource } from '@/types';

export function usePublicResources(params: {
  type: 'all' | PublicResource['type'];
  search: string;
  sort: 'recent' | 'oldest' | 'title';
  enabled: boolean;
}) {
  const { type, search, sort, enabled } = params;
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<PublicResource[]>([]);
  const [total, setTotal] = useState(0);

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set('type', type);
    if (search.trim().length > 0) sp.set('search', search.trim());
    sp.set('sort', sort);
    return sp.toString();
  }, [type, search, sort]);

  const reload = async () => {
    if (!enabled) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/content-library/public-resources?${query}`);
      const data = await res.json();
      if (data?.success) {
        setItems(data.data || []);
        setTotal(typeof data.total === 'number' ? data.total : 0);
        return;
      }
      console.error('[usePublicResources] load failed:', data);
      setItems([]);
      setTotal(0);
    } catch (error) {
      console.error('[usePublicResources] load failed:', error);
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

