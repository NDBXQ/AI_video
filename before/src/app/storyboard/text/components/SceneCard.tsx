// 场景卡片组件

import { OutlineItem, SceneGenerationStatus } from '../types';

interface SceneCardProps {
  index: number;
  item: OutlineItem;
  isSelected: boolean;
  isGenerating: boolean;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  onClick: () => void;
}

export function SceneCard({
  index,
  item,
  isSelected,
  isGenerating,
  status,
  onClick,
}: SceneCardProps) {
  const hasStoryboardText = (item.storyboardTexts && item.storyboardTexts.length > 0) || !!item.storyboardText;

  // 确定显示的状态图标
  let statusIcon = null;
  if (isGenerating) {
    if (hasStoryboardText) {
      statusIcon = (
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500">
          <svg
            className="h-3 w-3 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
      );
    } else if (status === 'generating') {
      statusIcon = (
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500">
          <svg
            className="h-3 w-3 animate-spin text-white"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        </div>
      );
    } else {
      statusIcon = (
        <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-gray-300">
          <div className="h-2 w-2 rounded-full bg-gray-300"></div>
        </div>
      );
    }
  } else if (hasStoryboardText) {
    statusIcon = (
      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500">
        <svg
          className="h-3 w-3 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={3}
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`w-full rounded-lg border-2 p-3 text-left transition-all ${
        isSelected
          ? 'border-indigo-500 bg-gradient-to-br from-indigo-50 to-purple-50 shadow-md'
          : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-gray-50'
      }`}
    >
      <div className="mb-1 flex items-center gap-2">
        {statusIcon}
        <span
          className={`text-xs font-bold ${
            isSelected ? 'text-indigo-700' : 'text-gray-600'
          }`}
        >
          场景 {index + 1}
        </span>
      </div>
      <p className="text-xs font-medium text-gray-900 line-clamp-2">
        {item.outline || '场景大纲'}
      </p>
    </button>
  );
}
