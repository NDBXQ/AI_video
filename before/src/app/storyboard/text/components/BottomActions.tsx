'use client';

import { Button } from '@/components/ui/button';

interface GeneratingProgress {
  completed: number;
  total: number;
  currentScene: string;
}

interface BottomActionsProps {
  isGenerating: boolean;
  generatingProgress: GeneratingProgress;
  storyId: string | null;
  shouldCancel: boolean;
  onSetShouldCancel: (cancel: boolean) => void;
}

export function BottomActions({
  isGenerating,
  generatingProgress,
  storyId,
  shouldCancel,
  onSetShouldCancel,
}: BottomActionsProps) {
  if (!storyId) {
    return (
      <div className="sticky bottom-0 z-10 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-900">准备进入视频创作</div>
            <div className="mt-1 text-sm text-gray-600">请先加载或创建一个故事，再进入视频创作</div>
          </div>
          <Button
            disabled
            className="w-full rounded-xl bg-gray-200 py-3 text-base font-semibold text-gray-600 sm:w-auto"
          >
            去创作视频
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="sticky bottom-0 z-10 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      {isGenerating ? (
        <div className="space-y-3">
          <div className="rounded-2xl bg-gray-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900">生成进度</span>
              <span className="text-sm font-semibold text-gray-900">
                {generatingProgress.completed} / {generatingProgress.total}
              </span>
            </div>

            <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full bg-indigo-600 transition-all duration-300"
                style={{
                  width: generatingProgress.total > 0
                    ? `${(generatingProgress.completed / generatingProgress.total) * 100}%`
                    : '0%',
                }}
              />
            </div>

            {generatingProgress.total > 0 && (
              <div className="text-xs text-gray-600">
                正在生成：<span className="font-medium text-gray-900">{generatingProgress.currentScene}</span>
              </div>
            )}

            {generatingProgress.total > 0 && (
              <div className="mt-2 text-xs text-gray-500">
                预计剩余 {Math.max(0, (generatingProgress.total - generatingProgress.completed) * 15)} 秒
              </div>
            )}

            {generatingProgress.total === 0 && (
              <div className="mt-2 text-xs text-gray-500">
                所有场景的分镜文本已存在，正在检查并更新...
              </div>
            )}
          </div>

          <Button
            onClick={() => {
              if (confirm('确定要取消生成吗？已生成的场景将保留。')) {
                onSetShouldCancel(true);
                alert('正在取消生成...');
              }
            }}
            variant="secondary"
            className="w-full rounded-xl bg-white text-gray-800 hover:bg-gray-50 ring-1 ring-gray-200"
          >
            取消生成
          </Button>
        </div>
      ) : (
        <Button
          onClick={() => {
            console.log('跳转到视频创作页面，storyId:', storyId);
            window.location.href = `/video-creation?storyId=${storyId}`;
          }}
          disabled={false}
          className="w-full rounded-xl bg-indigo-600 py-4 text-base font-semibold text-white hover:bg-indigo-700"
        >
          去创作视频
        </Button>
      )}
    </div>
  );
}
