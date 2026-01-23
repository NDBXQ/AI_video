'use client';

import { Button } from '@/components/ui/button';

interface GeneratingProgressProps {
  completed: number;
  total: number;
  currentScene: string;
  onCancel: () => void;
}

export function GeneratingProgress({ completed, total, currentScene, onCancel }: GeneratingProgressProps) {
  return (
    <div className="space-y-3">
      {/* 进度显示 */}
      <div className="rounded-lg bg-gradient-to-r from-indigo-50 to-purple-50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">
            生成进度
          </span>
          <span className="text-sm font-bold text-indigo-600">
            {completed} / {total}
          </span>
        </div>

        {/* 进度条 */}
        <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-300"
            style={{
              width: total > 0 ? `${(completed / total) * 100}%` : '0%',
            }}
          />
        </div>

        {/* 当前场景 */}
        {total > 0 && (
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <svg className="h-3 w-3 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="truncate">
              正在生成: {currentScene}
            </span>
          </div>
        )}

        {/* 预计时间 */}
        {total > 0 && (
          <div className="mt-2 text-xs text-gray-500">
            预计剩余时间: {Math.max(0, (total - completed) * 15)} 秒
          </div>
        )}

        {/* 如果所有场景都有分镜文本，显示提示 */}
        {total === 0 && (
          <div className="mt-2 text-xs text-gray-500">
            所有场景的分镜文本已存在，正在检查并更新...
          </div>
        )}
      </div>

      {/* 取消按钮 */}
      <Button
        onClick={onCancel}
        variant="secondary"
        className="w-full border-2 border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
      >
        <span className="flex items-center gap-2">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          取消生成
        </span>
      </Button>
    </div>
  );
}
