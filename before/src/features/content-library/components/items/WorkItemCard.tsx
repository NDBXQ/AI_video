'use client';

import Link from 'next/link';
import { Film, PenLine } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import type { Story } from '../../domain/types';
import { progressStageLabels } from '../../domain/constants';
import { getEditUrl } from '../../utils/items';

export function WorkItemCard({
  story,
  kind,
  selected,
  onToggleSelected,
}: {
  story: Story;
  kind: 'draft' | 'video';
  selected: boolean;
  onToggleSelected: () => void;
}) {
  const href = getEditUrl(story.progressStage, story.id);
  const stageText = progressStageLabels[story.progressStage] || story.progressStage;
  const ratioText = story.aspectRatio && story.aspectRatio.trim().length > 0 ? story.aspectRatio : '16:9';
  const resolutionText = story.resolution && story.resolution.trim().length > 0 ? story.resolution : '1920x1080';
  const presetText =
    story.resolutionPreset && story.resolutionPreset.trim().length > 0
      ? story.resolutionPreset
      : resolutionText === '1920x1080'
        ? '1080p'
        : resolutionText === '1280x720'
          ? '720p'
          : resolutionText.endsWith('x480')
            ? '480p'
            : '';
  const specText = `${ratioText}${presetText ? ` ${presetText}` : ''}`;

  return (
    <div className={cn('group relative overflow-hidden rounded-2xl border bg-white transition-shadow hover:shadow-lg', selected ? 'border-gray-900' : 'border-gray-200')}>
      <div className="absolute left-3 top-3 z-10">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelected}
          onClick={(e) => e.stopPropagation()}
          className="h-5 w-5 rounded-md border-gray-300 text-gray-900 focus:ring-gray-900"
        />
      </div>

      <Link href={href} className="block">
        <div className="relative aspect-video bg-gradient-to-br from-gray-50 to-gray-100">
          <div className="absolute inset-0 flex items-center justify-center">
            {kind === 'draft' ? <PenLine className="h-10 w-10 text-gray-400" /> : <Film className="h-10 w-10 text-gray-400" />}
          </div>
          <div className="absolute left-3 bottom-3 inline-flex items-center rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-gray-900 backdrop-blur">
            {kind === 'draft' ? stageText : '已完成'}
          </div>
          <div className="absolute right-3 bottom-3 inline-flex items-center rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-gray-900 backdrop-blur">
            {specText}
          </div>
        </div>
        <div className="p-4">
          <div className="line-clamp-1 text-sm font-semibold text-gray-900">{story.title}</div>
          <div className="mt-1.5 flex items-center justify-between text-xs text-gray-500">
            <span>{formatDate(story.updatedAt || story.createdAt)}</span>
            <span className="text-gray-700">继续编辑 →</span>
          </div>
        </div>
      </Link>
    </div>
  );
}
