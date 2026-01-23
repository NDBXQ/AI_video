/**
 * 分镜文本页面头部组件
 */

import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  urlStoryId: string | null;
  autoGenerate: boolean;
  step: 'input' | 'preview';
  onClear: () => void;
  onSaveDraft: () => void;
}

export function Header({ urlStoryId, autoGenerate, step, onClear, onSaveDraft }: HeaderProps) {
  return (
    <div className="relative flex items-start justify-between">
      <div>
        <Link
          href={`/storyboard/create/outline${urlStoryId ? `?storyId=${urlStoryId}` : ''}`}
          className="mb-2 inline-flex items-center text-sm font-medium text-gray-500 transition-colors hover:text-indigo-600"
        >
          <svg
            className="mr-2 h-4 w-4 transition-transform hover:-translate-x-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          返回
        </Link>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          {autoGenerate ? 'AI 正在生成场景文本' : '生成场景文本'}
        </h1>
        <p className="mt-1 text-base text-gray-600">
          {autoGenerate
            ? '基于故事大纲，AI 正在为您生成详细的场景描述'
            : '第二步：基于故事大纲，生成详细的场景描述'}
        </p>
      </div>
      {!autoGenerate && step === 'input' && (
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClear} className="rounded-xl border-gray-300 hover:bg-gray-50">
            清空输入
          </Button>
          <Button variant="secondary" onClick={onSaveDraft} className="rounded-xl border-gray-300 hover:bg-gray-50">
            保存草稿
          </Button>
        </div>
      )}
    </div>
  );
}
