import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { GeneratedOutline } from '../../types';

interface OutlinePreviewProps {
  generatedData: GeneratedOutline | null;
  isLoadingData: boolean;
  isSaving: boolean;
  onRegenerate: () => void;
  onNext: () => void;
}

/**
 * 大纲预览组件
 * 展示生成的故事大纲和操作按钮
 */
export function OutlinePreview({
  generatedData,
  isLoadingData,
  isSaving,
  onRegenerate,
  onNext,
}: OutlinePreviewProps) {
  const scenes = useMemo(() => generatedData?.outline_original_list ?? [], [generatedData]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectedScene = scenes[selectedIndex];

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-1">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-900">场景列表</div>
            <div className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
              {scenes.length} 个
            </div>
          </div>

          {isLoadingData ? (
            <div className="space-y-3">
              <div className="h-10 rounded-xl bg-gray-100" />
              <div className="h-10 rounded-xl bg-gray-100" />
              <div className="h-10 rounded-xl bg-gray-100" />
              <div className="h-10 rounded-xl bg-gray-100" />
            </div>
          ) : !generatedData || scenes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
              <div className="text-sm font-medium text-gray-900">暂无大纲数据</div>
              <div className="mt-1 text-sm text-gray-600">返回上一步修改输入后重新生成</div>
              <Button
                variant="secondary"
                onClick={onRegenerate}
                className="mt-4 rounded-xl bg-white text-gray-800 hover:bg-gray-50 ring-1 ring-gray-200"
              >
                返回修改
              </Button>
            </div>
          ) : (
            <div className="max-h-[560px] space-y-2 overflow-auto pr-1">
              {scenes.map((item, index) => {
                const isSelected = index === selectedIndex;
                return (
                  <button
                    key={index}
                    onClick={() => setSelectedIndex(index)}
                    className={[
                      'w-full rounded-xl border px-4 py-3 text-left transition-colors',
                      isSelected ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 bg-white hover:bg-gray-50',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gray-900 text-xs font-semibold text-white">
                            {index + 1}
                          </div>
                          <div className="truncate text-sm font-semibold text-gray-900">
                            {item.outline?.trim() || '未命名场景'}
                          </div>
                        </div>
                        <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-600">
                          {item.original?.trim() || '—'}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="lg:col-span-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
          {isLoadingData ? (
            <div className="space-y-3">
              <div className="h-6 w-40 rounded bg-gray-100" />
              <div className="h-24 rounded-xl bg-gray-100" />
              <div className="h-24 rounded-xl bg-gray-100" />
              <div className="h-24 rounded-xl bg-gray-100" />
            </div>
          ) : !generatedData || !selectedScene ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
              <div className="text-sm font-medium text-gray-900">请选择一个场景</div>
              <div className="mt-1 text-sm text-gray-600">在左侧列表中点击场景查看详情</div>
            </div>
          ) : (
            <div className="space-y-6">
              {generatedData.story_text ? (
                <div className="rounded-2xl bg-gray-50 p-5">
                  <div className="text-sm font-semibold text-gray-900">故事简介</div>
                  <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                    {generatedData.story_text}
                  </div>
                </div>
              ) : null}

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-900">场景 {selectedIndex + 1}</div>
                  <div className="mt-1 text-sm text-gray-600">检查大纲与原文片段，确认后进入下一步</div>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="rounded-2xl border border-gray-200 bg-white p-5">
                  <div className="text-sm font-semibold text-gray-900">大纲</div>
                  <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                    {selectedScene.outline}
                  </div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white p-5">
                  <div className="text-sm font-semibold text-gray-900">原文</div>
                  <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                    {selectedScene.original}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                <div className="text-sm font-semibold text-gray-900">提示</div>
                <div className="mt-1 text-sm text-gray-700">
                  点击“保存并下一步”会保存当前大纲到内容库，并进入场景文本生成流程。
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                <Button
                  variant="secondary"
                  onClick={onRegenerate}
                  className="rounded-xl bg-white text-gray-800 hover:bg-gray-50 ring-1 ring-gray-200"
                >
                  返回修改
                </Button>
                <Button
                  onClick={onNext}
                  disabled={isSaving}
                  className="rounded-xl bg-indigo-600 px-8 text-base font-semibold text-white hover:bg-indigo-700 disabled:opacity-70"
                  size="lg"
                >
                  {isSaving ? '保存中...' : '保存并下一步'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
