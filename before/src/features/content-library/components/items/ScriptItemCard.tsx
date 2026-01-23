'use client';

import { FileText } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import type { LibraryStoryboardScript } from '../../domain/types';

export function ScriptItemCard({
  script,
  selected,
  onToggleSelected,
  onOpen,
}: {
  script: LibraryStoryboardScript;
  selected: boolean;
  onToggleSelected: () => void;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'group relative w-full overflow-hidden rounded-2xl border bg-white text-left transition-shadow hover:shadow-lg',
        selected ? 'border-gray-900' : 'border-gray-200'
      )}
    >
      <div className="absolute left-3 top-3 z-10">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelected}
          onClick={(e) => e.stopPropagation()}
          className="h-5 w-5 rounded-md border-gray-300 text-gray-900 focus:ring-gray-900"
        />
      </div>

      <div className="aspect-video bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="flex h-full items-center justify-center">
          <FileText className="h-10 w-10 text-gray-400" />
        </div>
      </div>

      <div className="p-4">
        <div className="line-clamp-1 text-sm font-semibold text-gray-900">
          {script.sceneTitle || `分镜脚本 #${script.sequence}`}
        </div>
        <div className="mt-1 line-clamp-2 text-xs text-gray-600">
          {typeof (script as any).scriptContent === 'string'
            ? (script as any).scriptContent
            : (() => {
                try {
                  return JSON.stringify((script as any).scriptContent);
                } catch {
                  return String((script as any).scriptContent);
                }
              })()}
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
          <span>{formatDate(script.updatedAt || script.createdAt)}</span>
          <span className="text-gray-700">查看详情 →</span>
        </div>
      </div>
    </button>
  );
}
