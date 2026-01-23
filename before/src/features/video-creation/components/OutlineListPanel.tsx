/**
 * OutlineListPanel - 大纲选择面板（现代化设计）
 */

import { Story, OutlineData } from '../domain/types';
import { Sparkles, FileText, Loader2 } from 'lucide-react';

interface OutlineListPanelProps {
  stories: Story[];
  loading: boolean;
  selectedOutlineId: string | null;
  onOutlineSelect: (outline: OutlineData) => void;
}

// 渐变色彩方案
const gradientColors = [
  'from-violet-500 to-purple-600',
  'from-blue-500 to-cyan-500',
  'from-emerald-500 to-teal-500',
  'from-orange-500 to-red-500',
  'from-pink-500 to-rose-500',
  'from-indigo-500 to-blue-600',
  'from-amber-500 to-yellow-500',
  'from-cyan-500 to-blue-500',
];

// 获取渐变颜色
const getGradientColor = (index: number) => {
  return gradientColors[index % gradientColors.length];
};

// 大纲卡片组件（现代化设计）
function OutlineCard({
  outline,
  selected,
  onClick,
  index,
}: {
  outline: OutlineData;
  selected: boolean;
  onClick: () => void;
  index: number;
}) {
  const gradient = getGradientColor(outline.sequence);

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-start gap-2.5 p-2.5 rounded-lg border-2 transition-all duration-300 text-left group relative overflow-hidden ${
        selected
          ? 'border-violet-500 bg-gradient-to-r from-violet-50 to-purple-50 shadow-lg shadow-violet-200/50'
          : 'border-gray-200/60 hover:border-violet-300 bg-white hover:shadow-md hover:shadow-violet-100/40'
      }`}
    >
      {/* 背景装饰 */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />

      {/* 序号徽章 */}
      <div
        className={`relative h-9 w-9 rounded-lg bg-gradient-to-br ${gradient} flex-shrink-0 flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300`}
      >
        <span className="text-white text-xs font-bold">
          {outline.sequence}
        </span>
      </div>

      {/* 大纲文本 */}
      <div className="flex-1 min-w-0 relative z-10">
        <p className={`text-xs font-medium line-clamp-2 transition-colors ${
          selected ? 'text-violet-900' : 'text-gray-900 group-hover:text-violet-700'
        }`}>
          {outline.outlineText}
        </p>
        <p className="mt-1 text-[10px] text-gray-500 line-clamp-2">
          {outline.originalText}
        </p>
      </div>

      {/* 选中指示器 */}
      {selected && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <div className="w-5 h-5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center shadow-sm">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
      )}
    </button>
  );
}

export function OutlineListPanel({
  stories,
  loading,
  selectedOutlineId,
  onOutlineSelect,
}: OutlineListPanelProps) {
  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center py-8">
        <div className="relative">
          <div className="absolute inset-0 bg-violet-200 rounded-full blur-lg animate-pulse" />
          <div className="relative w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="mt-3 text-xs font-medium text-gray-600">加载故事中...</p>
      </div>
    );
  }

  if (stories.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center py-8 text-center px-4">
        <div className="w-12 h-12 mb-3 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center shadow-inner">
          <FileText className="w-6 h-6 text-gray-400" />
        </div>
        <p className="text-xs text-gray-600 font-semibold mb-1">暂无故事</p>
        <p className="text-[10px] text-gray-500 leading-relaxed">
          请从剧本创作或内容库页面跳转过来
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 可滚动的内容区域 */}
      <div className="flex-1 overflow-y-auto pr-2 space-y-2 pb-2 custom-scrollbar">
        {stories.map((story) => (
          <div key={story.id} className="space-y-2">
            {/* 故事分隔标题（现代化设计） */}
            {story.outlines && story.outlines.length > 0 && (
              <div className="px-2.5 py-1.5 text-xs font-bold text-violet-700 bg-gradient-to-r from-violet-50 to-purple-50 rounded-lg border border-violet-100 flex items-center gap-1.5 flex-shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                {story.title}
              </div>
            )}

            {/* 大纲列表 */}
            {story.outlines && story.outlines.length > 0 && (
              <div className="space-y-2">
                {story.outlines.map((outline) => (
                  <OutlineCard
                    key={outline.id}
                    outline={outline}
                    selected={selectedOutlineId === outline.id}
                    onClick={() => onOutlineSelect(outline)}
                    index={outline.sequence}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 自定义滚动条样式 */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(to bottom, #8b5cf6, #ec4899);
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(to bottom, #7c3aed, #db2777);
        }
      `}</style>
    </div>
  );
}
