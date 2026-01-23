'use client';

import { Button } from '@/components/ui/button';

interface SceneItem {
  outline: string;
  original: string;
  storyboardText?: string;
  storyboardTexts?: Array<{
    id: string;
    sequence: number;
    shotCut: boolean;
    storyboardText: string;
  }>;
  shotCut?: boolean;
}

interface SceneDetailProps {
  scene: SceneItem;
  sceneIndex: number;
  totalScenes?: number;
  onPreviousScene?: () => void;
  onNextScene?: () => void;
  onRegenerate?: () => void;
}

export function SceneDetail({
  scene,
  sceneIndex,
  totalScenes,
  onPreviousScene,
  onNextScene,
  onRegenerate,
}: SceneDetailProps) {
  const showNavigation = !!onPreviousScene && !!onNextScene && typeof totalScenes === 'number';
  const storyboardEntries =
    scene.storyboardTexts && scene.storyboardTexts.length > 0
      ? scene.storyboardTexts
      : scene.storyboardText
        ? [
            {
              id: 'single',
              sequence: 1,
              shotCut: scene.shotCut ?? false,
              storyboardText: scene.storyboardText,
            },
          ]
        : [];

  return (
    <div className="space-y-4">
      <div className="grid gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
          <div className="text-sm font-semibold text-gray-900">大纲</div>
          <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{scene.outline}</div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
          <div className="text-sm font-semibold text-gray-900">原文</div>
          <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{scene.original}</div>
        </div>
      </div>

      {/* 分镜文本 */}
      {storyboardEntries.length > 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-gray-900">分镜文本</div>
            {onRegenerate ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={onRegenerate}
                className="rounded-xl bg-white text-gray-800 hover:bg-gray-50 ring-1 ring-gray-200"
              >
                重新生成
              </Button>
            ) : null}
          </div>

          <div className="space-y-4">
            {storyboardEntries.map((entry) => (
              <div key={entry.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-gray-900">
                    {storyboardEntries.length > 1 ? `镜头 ${entry.sequence}` : '内容'}
                  </div>
                  <span
                    className={[
                      'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
                      entry.shotCut ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-700',
                    ].join(' ')}
                  >
                    {entry.shotCut ? '需要切镜' : '无需切镜'}
                  </span>
                </div>
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{entry.storyboardText}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-5">
          <div className="text-sm font-semibold text-gray-900">分镜文本未生成</div>
          <div className="mt-1 text-sm text-gray-600">点击“重新生成”开始生成该场景的分镜文本</div>
        </div>
      )}

      {/* 场景导航 */}
      {showNavigation && (
        <div className="flex items-center justify-between">
          <Button
            size="sm"
            variant="secondary"
            onClick={onPreviousScene}
            disabled={sceneIndex === 0}
            className="rounded-xl bg-white text-gray-800 hover:bg-gray-50 ring-1 ring-gray-200"
          >
            上一场景
          </Button>
          <span className="text-sm font-medium text-gray-600">
            {sceneIndex + 1} / {totalScenes}
          </span>
          <Button
            size="sm"
            variant="secondary"
            onClick={onNextScene}
            disabled={sceneIndex === (totalScenes as number) - 1}
            className="rounded-xl bg-white text-gray-800 hover:bg-gray-50 ring-1 ring-gray-200"
          >
            下一场景
          </Button>
        </div>
      )}
    </div>
  );
}
