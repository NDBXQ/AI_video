'use client';

import { cn } from '@/lib/utils';
import type { PublicResource } from '@/types';
import { ContentGrid } from './views/ContentGrid';
import { ContentList } from './views/ContentList';
import { PublicResourceCard } from './items/PublicResourceCard';
import type { DetailsItem, ViewMode } from '../domain/types';

export function PublicPane({
  resources,
  viewMode,
  selectedIds,
  onToggleSelected,
  onOpenDetails,
}: {
  resources: PublicResource[];
  viewMode: ViewMode;
  selectedIds: Set<string>;
  onToggleSelected: (id: string) => void;
  onOpenDetails: (item: DetailsItem) => void;
}) {
  if (resources.length <= 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white">
        <div className="text-center">
          <div className="text-sm font-medium text-gray-900">暂无匹配资源</div>
          <div className="mt-1 text-sm text-gray-600">尝试切换分类或调整搜索条件</div>
        </div>
      </div>
    );
  }

  if (viewMode === 'grid') {
    return (
      <ContentGrid>
        {resources.map((resource) => {
          const selected = selectedIds.has(resource.id);
          return (
            <PublicResourceCard
              key={resource.id}
              resource={resource}
              selected={selected}
              onToggleSelected={() => onToggleSelected(resource.id)}
              onOpen={() => onOpenDetails({ kind: 'public', resource })}
            />
          );
        })}
      </ContentGrid>
    );
  }

  return (
    <ContentList>
      {resources.map((resource) => {
        const selected = selectedIds.has(resource.id);
        return (
          <div key={resource.id} className={cn('flex items-center gap-3 px-4 py-3', selected ? 'bg-gray-50' : 'bg-white')}>
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelected(resource.id)}
              className="h-5 w-5 rounded-md border-gray-300 text-gray-900 focus:ring-gray-900"
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-gray-900">{resource.name}</div>
              <div className="mt-0.5 truncate text-xs text-gray-600">{resource.description}</div>
            </div>
            <button
              type="button"
              className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              onClick={() => onOpenDetails({ kind: 'public', resource })}
            >
              详情
            </button>
          </div>
        );
      })}
    </ContentList>
  );
}

