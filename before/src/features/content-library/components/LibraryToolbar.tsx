'use client';

import { LayoutGrid, List, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SortKey, ViewMode } from '../domain/types';
import { sortLabels } from '../domain/constants';
import type { ReactNode } from 'react';

export function LibraryToolbar({
  search,
  onSearchChange,
  sortKey,
  onSortKeyChange,
  viewMode,
  onViewModeChange,
  actions,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  sortKey: SortKey;
  onSortKeyChange: (value: SortKey) => void;
  viewMode: ViewMode;
  onViewModeChange: (value: ViewMode) => void;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="搜索标题、提示词、标签…"
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition-colors focus:border-gray-900"
        />
      </div>

      <div className="flex items-center gap-2">
        {actions ? <div className="hidden items-center gap-2 sm:flex">{actions}</div> : null}
        <select
          value={sortKey}
          onChange={(e) => onSortKeyChange(e.target.value as SortKey)}
          className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-gray-900"
        >
          {Object.keys(sortLabels).map((key) => (
            <option key={key} value={key}>
              {sortLabels[key as SortKey]}
            </option>
          ))}
        </select>

        <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1">
          <button
            type="button"
            onClick={() => onViewModeChange('grid')}
            className={cn(
              'inline-flex h-8 w-9 items-center justify-center rounded-lg transition-colors',
              viewMode === 'grid' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'
            )}
            aria-label="网格视图"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('list')}
            className={cn(
              'inline-flex h-8 w-9 items-center justify-center rounded-lg transition-colors',
              viewMode === 'list' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'
            )}
            aria-label="列表视图"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
