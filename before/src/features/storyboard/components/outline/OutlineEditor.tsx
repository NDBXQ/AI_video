import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/select-field';

interface OutlineEditorProps {
  inputType: 'original' | 'brief';
  setInputType: (type: 'original' | 'brief') => void;
  storyTitle: string;
  setStoryTitle: (title: string) => void;
  aspectRatio: '16:9' | '4:3' | '3:4' | '9:16';
  setAspectRatio: (value: '16:9' | '4:3' | '3:4' | '9:16') => void;
  resolutionPreset: '480p' | '720p' | '1080p';
  setResolutionPreset: (value: '480p' | '720p' | '1080p') => void;
  content: string;
  setContent: (content: string) => void;
  isGenerating: boolean;
  onGenerate: () => void;
}

/**
 * 大纲编辑组件
 * 包含输入类型切换、标题输入、内容输入和生成按钮
 */
export function OutlineEditor({
  inputType,
  setInputType,
  storyTitle,
  setStoryTitle,
  aspectRatio,
  setAspectRatio,
  resolutionPreset,
  setResolutionPreset,
  content,
  setContent,
  isGenerating,
  onGenerate,
}: OutlineEditorProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-900">输入方式</div>
              <div className="mt-1 text-sm text-gray-600">
                {inputType === 'original' ? '适合长文本原文，AI 负责结构化' : '适合简短概述，AI 负责补全细节'}
              </div>
            </div>

            <div className="flex rounded-xl bg-gray-100 p-1">
              <button
                onClick={() => setInputType('original')}
                disabled={isGenerating}
                className={[
                  'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                  inputType === 'original' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900',
                  isGenerating ? 'cursor-not-allowed opacity-70' : '',
                ].join(' ')}
              >
                故事原文
              </button>
              <button
                onClick={() => setInputType('brief')}
                disabled={isGenerating}
                className={[
                  'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                  inputType === 'brief' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900',
                  isGenerating ? 'cursor-not-allowed opacity-70' : '',
                ].join(' ')}
              >
                剧情简介
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-900">故事标题</label>
              <input
                type="text"
                value={storyTitle}
                onChange={(e) => setStoryTitle(e.target.value)}
                placeholder="例如：城市奇遇记（选填）"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                disabled={isGenerating}
                maxLength={100}
              />
              <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                <span>建议 8–20 字，方便后续管理</span>
                <span className={storyTitle.length >= 100 ? 'text-red-600' : ''}>{storyTitle.length}/100</span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-900">视频比例</label>
                <SelectField
                  value={aspectRatio}
                  onChange={setAspectRatio}
                  options={[
                    { value: '16:9', label: '16:9', description: '横屏 · 通用' },
                    { value: '4:3', label: '4:3', description: '传统比例' },
                    { value: '3:4', label: '3:4', description: '竖向 · 海报感' },
                    { value: '9:16', label: '9:16', description: '竖屏 · 短视频' },
                  ]}
                  disabled={isGenerating}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-900">分辨率</label>
                <SelectField
                  value={resolutionPreset}
                  onChange={setResolutionPreset}
                  options={[
                    { value: '480p', label: '480p', description: '预览更快' },
                    { value: '720p', label: '720p', description: '标准' },
                    { value: '1080p', label: '1080p', description: '高清' },
                  ]}
                  disabled={isGenerating}
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-900">
                {inputType === 'original' ? '故事原文' : '剧情简介'}
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={inputType === 'original' ? '粘贴或输入原文，支持长文本与多段落' : '用几段话概括剧情、人物与冲突'}
                className="h-72 w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm leading-relaxed text-gray-900 placeholder-gray-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                disabled={isGenerating}
              />
              <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                <span>支持换行输入</span>
                <span className="font-medium text-gray-700">{content.length} 字</span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-900">生成故事大纲</div>
              <div className="mt-1 text-sm text-gray-600">生成后可逐场景检查，再进入下一步生成场景文本</div>
            </div>
            <Button
              onClick={onGenerate}
              disabled={isGenerating || !content.trim()}
              className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 focus:ring-indigo-500"
              size="lg"
            >
              {isGenerating ? '生成中...' : '开始生成'}
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
          <div className="text-sm font-semibold text-gray-900">写作建议</div>
          <div className="mt-3 space-y-2 text-sm text-gray-600">
            <div className="flex gap-2">
              <div className="mt-1 h-1.5 w-1.5 rounded-full bg-gray-400" />
              <div>尽量明确人物、地点、时间与主要冲突</div>
            </div>
            <div className="flex gap-2">
              <div className="mt-1 h-1.5 w-1.5 rounded-full bg-gray-400" />
              <div>一段写一件事，结构更清晰</div>
            </div>
            <div className="flex gap-2">
              <div className="mt-1 h-1.5 w-1.5 rounded-full bg-gray-400" />
              <div>长文本建议先精简到“关键剧情”再生成</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
          <div className="text-sm font-semibold text-gray-900">示例参考</div>
          <div className="mt-3 rounded-xl bg-gray-50 p-4 text-sm leading-relaxed text-gray-700">
            在一个繁华的城市里，两个年轻人在咖啡店相遇，开始了一段浪漫的故事。男主角叫李明，是一名 28 岁的职场白领。女主角叫小红，在画廊工作。一次偶然的停留，让他们的生活开始改变……
          </div>
        </div>
      </div>
    </div>
  );
}
