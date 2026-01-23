'use client';

import { cn } from '@/lib/utils';
import type { LibraryScope } from '../domain/types';

export function LibraryTabs({
  value,
  onChange,
}: {
  value: LibraryScope;
  onChange: (value: LibraryScope) => void;
}) {
  return (
    <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1">
      <button
        type="button"
        onClick={() => onChange('works')}
        className={cn(
          'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
          value === 'works' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-50'
        )}
      >
        我的内容
      </button>
      <button
        type="button"
        onClick={() => onChange('public')}
        className={cn(
          'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
          value === 'public' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-50'
        )}
      >
        公共资源
      </button>
    </div>
  );
}

