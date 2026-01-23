/**
 * 输入区域组件
 */

import { Button } from '@/components/ui/button';

interface InputSectionProps {
  inputType: 'original' | 'brief';
  setInputType: (type: 'original' | 'brief') => void;
  content: string;
  setContent: (content: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

export function InputSection({
  inputType,
  setInputType,
  content,
  setContent,
  onGenerate,
  isGenerating,
}: InputSectionProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* 左侧：输入区 */}
      <div className="space-y-4">
        {/* 输入类型切换 */}
        <div className="flex overflow-hidden rounded-xl border-2 border-gray-200 bg-gray-50 p-1 transition-all focus-within:border-indigo-300">
          <button
            onClick={() => setInputType('original')}
            className={`flex-1 rounded-lg px-6 py-2.5 text-sm font-semibold transition-all duration-200 ${
              inputType === 'original' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            故事原文输入
          </button>
          <button
            onClick={() => setInputType('brief')}
            className={`flex-1 rounded-lg px-6 py-2.5 text-sm font-semibold transition-all duration-200 ${
              inputType === 'brief' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            剧情简介输入
          </button>
        </div>

        {/* 文本输入框 */}
        <div className="group relative overflow-hidden rounded-xl border-2 border-gray-200 bg-white transition-all duration-300 hover:border-gray-300 focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-100">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`请输入${inputType === 'original' ? '故事原文' : '剧情简介'}...`}
            className="h-56 w-full resize-none rounded-b-lg border-0 p-4 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none disabled:bg-gray-50"
            disabled={isGenerating}
          />
          <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-4 py-2 text-xs">
            <div className="flex items-center gap-2 text-gray-500">
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
              </svg>
              <span>支持换行输入</span>
            </div>
            <div className="font-medium text-gray-700">
              <span className="text-indigo-600">{content.length}</span> 字
            </div>
          </div>
        </div>

        {/* 生成按钮 */}
        <Button
          onClick={onGenerate}
          disabled={isGenerating || !content.trim()}
          className={`w-full py-5 text-base font-semibold transition-all duration-300 ${
            !isGenerating && content.trim()
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 hover:shadow-xl hover:shadow-indigo-200'
              : ''
          }`}
          size="lg"
        >
          {isGenerating ? (
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              AI生成中，预计需要10-30秒...
            </span>
          ) : (
            '生成分镜文本'
          )}
        </Button>
        {isGenerating && (
          <div className="rounded-lg bg-gradient-to-r from-indigo-50 to-purple-50 p-3 text-center">
            <div className="flex items-center justify-center gap-2 text-xs text-indigo-700">
              <svg className="h-4 w-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>AI正在处理您的请求，请稍候...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
