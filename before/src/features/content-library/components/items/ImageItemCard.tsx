'use client';

import { cn, formatDate } from '@/lib/utils';
import type { Image } from '@/types';

export function ImageItemCard({
  image,
  selected,
  onToggleSelected,
  onOpen,
}: {
  image: Image;
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

      <div className="relative aspect-video bg-gray-100">
        <img src={image.url} alt={image.prompt} className="h-full w-full object-cover" />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/50 to-transparent" />
      </div>

      <div className="p-4">
        <div className="line-clamp-2 text-sm font-semibold text-gray-900">{image.prompt}</div>
        <div className="mt-2 flex flex-wrap gap-1">
          {image.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
              {tag}
            </span>
          ))}
        </div>
        <div className="mt-2 text-xs text-gray-500">{formatDate(image.createdAt)}</div>
      </div>
    </button>
  );
}

