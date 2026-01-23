'use client';

interface SceneItem {
  outline: string;
  original: string;
  outlineId?: string;
  sequence?: number;
  storyboardText?: string;
  storyboardTexts?: Array<{
    id: string;
    sequence: number;
    shotCut: boolean;
    storyboardText: string;
  }>;
  shotCut?: boolean;
  storyboardTextId?: string;
  generationStatus?: 'pending' | 'generating' | 'completed' | 'failed';
}

interface SceneListProps {
  scenes: SceneItem[];
  selectedIndex: number;
  onSelectScene: (index: number) => void;
  disabled?: boolean;
}

/**
 * 将标题按“8 个单位”截断：汉字=1单位，英文/数字单词=1单位，其它字符=1单位
 * @param {string} input - 原始标题
 * @param {number} maxUnits - 最大单位数
 * @returns {string} 截断后的标题
 */
function truncateTitle(input: string, maxUnits: number = 8): string {
  const text = (input || '').trim();
  if (!text) return '';

  const isCjk = (char: string) => /[\u3400-\u9FFF]/.test(char);
  const isWordChar = (char: string) => /[A-Za-z0-9]/.test(char);

  let units = 0;
  let i = 0;
  let out = '';

  while (i < text.length && units < maxUnits) {
    const ch = text[i];

    if (/\s/.test(ch)) {
      if (out && !out.endsWith(' ')) out += ' ';
      while (i < text.length && /\s/.test(text[i])) i++;
      continue;
    }

    if (isCjk(ch)) {
      out += ch;
      units += 1;
      i += 1;
      continue;
    }

    if (isWordChar(ch)) {
      let j = i + 1;
      while (j < text.length && isWordChar(text[j])) j++;
      out += text.slice(i, j);
      units += 1;
      i = j;
      continue;
    }

    out += ch;
    units += 1;
    i += 1;
  }

  const remaining = text.slice(i).trim();
  const normalized = out.trimEnd();
  return remaining ? `${normalized}...` : normalized;
}

export function SceneList({ scenes, selectedIndex, onSelectScene, disabled }: SceneListProps) {
  if (!scenes || scenes.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">场景列表</h3>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
          {scenes.length} 个
        </span>
      </div>

      <div className="space-y-2">
        {scenes.map((scene, index) => {
          const isSelected = index === selectedIndex;
          const hasStoryboardText =
            (scene.storyboardTexts && scene.storyboardTexts.length > 0) ||
            (!!scene.storyboardText && scene.storyboardText.length > 0);
          const isGenerating = scene.generationStatus === 'generating';

          return (
            <button
              key={index}
              onClick={() => !disabled && !isGenerating && onSelectScene(index)}
              disabled={disabled || isGenerating}
              className={[
                'w-full rounded-xl border px-4 py-3 text-left transition-colors',
                isSelected ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 bg-white hover:bg-gray-50',
                disabled || isGenerating ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
              ].join(' ')}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gray-900 text-xs font-semibold text-white">
                      {index + 1}
                    </span>
                    <span className="min-w-0 truncate text-sm font-semibold text-gray-900">
                      {truncateTitle(scene.outline || '') || '未命名场景'}
                    </span>
                  </div>

                  {/* 状态标识 */}
                  <div className="mt-2 flex items-center gap-2">
                    {hasStoryboardText ? (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                        已生成
                      </span>
                    ) : isGenerating ? (
                      <span className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-medium text-indigo-700">
                        生成中
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                        未生成
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
