'use client';

import { Music2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PublicResource } from '@/types';

export function PublicResourceCard({
  resource,
  selected,
  onToggleSelected,
  onOpen,
}: {
  resource: PublicResource;
  selected: boolean;
  onToggleSelected: () => void;
  onOpen: () => void;
}) {
  const fallbackIcon = resource.type === 'music' ? <Music2 className="h-10 w-10 text-gray-400" /> : <Sparkles className="h-10 w-10 text-gray-400" />;

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

      <div className="relative aspect-square bg-gray-100">
        {resource.previewUrl || resource.originalUrl ? (
          <img
            src={resource.previewUrl || resource.originalUrl}
            alt={resource.name}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">{fallbackIcon}</div>
        )}
      </div>

      <div className="p-4">
        <div className="line-clamp-1 text-sm font-semibold text-gray-900">{resource.name}</div>
        <div className="mt-1 line-clamp-2 text-xs text-gray-600">{resource.description}</div>
        <div className="mt-2 flex flex-wrap gap-1">
          {resource.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}
