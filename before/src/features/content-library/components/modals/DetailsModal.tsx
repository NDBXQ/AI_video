'use client';

import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DetailsItem } from '../../domain/types';
import { getDetailsTitle } from '../../utils/items';

export function DetailsModal({
  open,
  item,
  onClose,
}: {
  open: boolean;
  item: DetailsItem | null;
  onClose: () => void;
}) {
  if (!open || !item) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-label="关闭"
      />
      <div className="absolute left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="text-sm font-semibold text-gray-900">{getDetailsTitle(item)}</div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-gray-600 hover:bg-gray-50"
            aria-label="关闭"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-5">
          {item.kind === 'script' && (
            <div className="space-y-4">
              <div className="text-lg font-semibold text-gray-900">
                {item.script.sceneTitle || `分镜脚本 #${item.script.sequence}`}
              </div>
              <div className="text-sm text-gray-600">序号：{item.script.sequence}</div>
              <div className={cn('rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800')}>
                {typeof (item as any).script.scriptContent === 'string'
                  ? (item as any).script.scriptContent
                  : (() => {
                      try {
                        return JSON.stringify((item as any).script.scriptContent, null, 2);
                      } catch {
                        return String((item as any).script.scriptContent);
                      }
                    })()}
              </div>
            </div>
          )}

          {item.kind === 'public' && (
            <div className="space-y-4">
              <div className="text-lg font-semibold text-gray-900">{item.resource.name}</div>
              <div className="text-sm text-gray-600">{item.resource.description}</div>
              {item.resource.originalUrl || item.resource.previewUrl ? (
                <div className="overflow-hidden rounded-2xl bg-gray-100">
                  <img
                    src={item.resource.originalUrl || item.resource.previewUrl}
                    alt={item.resource.name}
                    className="w-full object-contain"
                  />
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {item.resource.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
