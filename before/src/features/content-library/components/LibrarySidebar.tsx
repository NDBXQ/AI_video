'use client';

import { cn } from '@/lib/utils';
import type { PublicSection, WorksSection } from '../domain/types';
import { publicSectionLabels, worksSectionLabels } from '../domain/constants';

export function LibrarySidebar({
  mode,
  worksSection,
  publicSection,
  worksCounts,
  publicCounts,
  onWorksSectionChange,
  onPublicSectionChange,
}: {
  mode: 'works' | 'public';
  worksSection: WorksSection;
  publicSection: PublicSection;
  worksCounts: Record<WorksSection, number>;
  publicCounts: Record<PublicSection, number>;
  onWorksSectionChange: (value: WorksSection) => void;
  onPublicSectionChange: (value: PublicSection) => void;
}) {
  const items =
    mode === 'works'
      ? (Object.keys(worksSectionLabels) as WorksSection[]).map((key) => ({
          key,
          label: worksSectionLabels[key],
          count: worksCounts[key],
          active: worksSection === key,
          onClick: () => onWorksSectionChange(key),
        }))
      : (Object.keys(publicSectionLabels) as PublicSection[]).map((key) => ({
          key,
          label: publicSectionLabels[key],
          count: publicCounts[key],
          active: publicSection === key,
          onClick: () => onPublicSectionChange(key),
        }));

  return (
    <aside className="rounded-2xl border border-gray-200 bg-white p-3">
      <div className="px-2 py-1.5 text-xs font-semibold text-gray-500">分类</div>
      <div className="mt-1 space-y-1">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={item.onClick}
            className={cn(
              'flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors',
              item.active ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-50'
            )}
          >
            <span className="truncate">{item.label}</span>
            <span className={cn('ml-3 rounded-full px-2 py-0.5 text-xs', item.active ? 'bg-white/15' : 'bg-gray-100 text-gray-600')}>
              {item.count}
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}

