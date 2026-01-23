'use client';

import { cn } from '@/lib/utils';
import { ContentGrid } from './views/ContentGrid';
import { ContentList } from './views/ContentList';
import { WorkItemCard } from './items/WorkItemCard';
import { ScriptItemCard } from './items/ScriptItemCard';
import type { DetailsItem, ViewMode, WorksItem } from '../domain/types';
import { getWorksItemId } from '../utils/items';

export function WorksPane({
  loading,
  items,
  viewMode,
  selectedIds,
  onToggleSelected,
  onOpenDetails,
}: {
  loading: boolean;
  items: WorksItem[];
  viewMode: ViewMode;
  selectedIds: Set<string>;
  onToggleSelected: (id: string) => void;
  onOpenDetails: (item: DetailsItem) => void;
}) {
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-gray-200 bg-white">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-gray-900 border-t-transparent" />
          <div className="text-sm text-gray-600">加载中…</div>
        </div>
      </div>
    );
  }

  if (items.length <= 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white">
        <div className="text-center">
          <div className="text-sm font-medium text-gray-900">暂无内容</div>
          <div className="mt-1 text-sm text-gray-600">从左侧选择其他分类，或调整搜索条件</div>
        </div>
      </div>
    );
  }

  if (viewMode === 'grid') {
    return (
      <ContentGrid>
        {items.map((item) => {
          const id = getWorksItemId(item);
          const selected = selectedIds.has(id);

          if (item.kind === 'draft' || item.kind === 'video') {
            return (
              <WorkItemCard
                key={id}
                story={item.story}
                kind={item.kind}
                selected={selected}
                onToggleSelected={() => onToggleSelected(id)}
              />
            );
          }

          if (item.kind === 'script') {
            return (
              <ScriptItemCard
                key={id}
                script={item.script}
                selected={selected}
                onToggleSelected={() => onToggleSelected(id)}
                onOpen={() => onOpenDetails({ kind: 'script', script: item.script })}
              />
            );
          }
        })}
      </ContentGrid>
    );
  }

  return (
    <ContentList>
      {items.map((item) => {
        const id = getWorksItemId(item);
        const selected = selectedIds.has(id);

        return (
          <div key={id} className={cn('flex items-center gap-3 px-4 py-3', selected ? 'bg-gray-50' : 'bg-white')}>
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelected(id)}
              className="h-5 w-5 rounded-md border-gray-300 text-gray-900 focus:ring-gray-900"
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-gray-900">
                {item.kind === 'draft' || item.kind === 'video'
                  ? item.story.title
                  : item.script.sceneTitle || `分镜脚本 #${item.script.sequence}`}
              </div>
              <div className="mt-0.5 truncate text-xs text-gray-600">
                {item.kind === 'draft' || item.kind === 'video'
                  ? item.story.progressStage
                  : typeof (item as any).script.scriptContent === 'string'
                    ? (item as any).script.scriptContent
                    : (() => {
                        try {
                          return JSON.stringify((item as any).script.scriptContent);
                        } catch {
                          return String((item as any).script.scriptContent);
                        }
                      })()}
              </div>
            </div>
            <button
              type="button"
              className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              onClick={() => {
                if (item.kind === 'script') onOpenDetails({ kind: 'script', script: item.script });
              }}
              disabled={item.kind === 'draft' || item.kind === 'video'}
            >
              详情
            </button>
          </div>
        );
      })}
    </ContentList>
  );
}
