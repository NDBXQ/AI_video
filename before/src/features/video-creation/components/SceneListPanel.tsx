/**
 * SceneListPanel - 分镜列表面板（现代化设计）
 */

import { Scene } from '../domain/types';
import { Film, Sparkles, Zap, CheckCircle2, Clock, Eye, Loader2, Image as ImageIcon, HelpCircle } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';

interface SceneListPanelProps {
  scenes: Scene[];
  loading: boolean;
  generating: boolean; // 是否正在批量生成
  selectedId: string | null;
  onSelect: (id: string) => void;
  onGenerateAll: () => void; // 批量生成分镜脚本
  onViewScript: (sceneId: string) => void; // 查看分镜脚本
}

// 分镜卡片组件
function SceneCard({
  scene,
  index,
  selected,
  onSelect,
  onViewScript,
  activeTooltip,
  setActiveTooltip,
}: {
  scene: Scene;
  index: number;
  selected: boolean;
  onSelect: (id: string) => void;
  onViewScript: (sceneId: string) => void;
  activeTooltip: { sceneId: string; content: string; position: { top: number; left: number } } | null;
  setActiveTooltip: (tooltip: { sceneId: string; content: string; position: { top: number; left: number } } | null) => void;
}) {
  const helpIconRef = useRef<HTMLDivElement>(null);
  const isTooltipActive = activeTooltip?.sceneId === scene.id;

  const handleMouseEnter = () => {
    if (helpIconRef.current && scene.content) {
      const rect = helpIconRef.current.getBoundingClientRect();
      setActiveTooltip({
        sceneId: scene.id,
        content: scene.content,
        position: {
          top: rect.bottom + 8,
          left: rect.left,
        },
      });
    }
  };

  const handleMouseLeave = () => {
    if (isTooltipActive) {
      setActiveTooltip(null);
    }
  };

  return (
    <div
      className={`group relative rounded-xl border-2 transition-all duration-300 ${
        selected
          ? 'border-violet-500 bg-gradient-to-r from-violet-50/80 to-purple-50/80 shadow-lg shadow-violet-200/50'
          : 'border-gray-200/60 hover:border-violet-300 bg-white/80 hover:shadow-md hover:shadow-violet-100/40'
      }`}
    >
      {(scene.isVideoGenerated || scene.hasReferenceImages) && (
        <div className="absolute top-2 right-9 w-11 h-5">
          {scene.hasReferenceImages && (
            <div className="absolute left-0 w-5 h-5 bg-gradient-to-br from-orange-400 to-amber-500 rounded-full flex items-center justify-center shadow-sm border border-white/70">
              <ImageIcon className="w-3 h-3 text-white" />
            </div>
          )}
          {scene.isVideoGenerated && (
            <div className="absolute right-0 w-5 h-5 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-full flex items-center justify-center shadow-sm border border-white/70">
              <Film className="w-3 h-3 text-white" />
            </div>
          )}
        </div>
      )}
      {/* 分镜信息 */}
      <div
        className="flex items-center gap-2.5 cursor-pointer p-2.5"
        onClick={() => onSelect(scene.id)}
      >
        {/* 分镜状态指示器 */}
        <div className="flex-shrink-0 h-12 w-12 rounded-xl overflow-hidden shadow-sm group-hover:scale-105 transition-transform duration-300 relative">
          {/* 状态背景色 */}
          <div className={`
            absolute inset-0 flex items-center justify-center
            ${scene.scriptGenerating 
              ? 'bg-gradient-to-br from-blue-400 to-blue-600'  // 生成中
              : scene.generatedScript && scene.generatedScript
                ? 'bg-gradient-to-br from-emerald-400 to-green-600'  // 已生成脚本
                : 'bg-gradient-to-br from-gray-200 to-gray-300'      // 未生成
            }
          `}>
            {/* 生成中显示旋转动画 */}
            {scene.scriptGenerating ? (
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            ) : (
              <span className={`text-lg font-bold ${
                scene.generatedScript && scene.generatedScript
                  ? 'text-white'
                  : 'text-gray-500'
              }`}>
                {index + 1}
              </span>
            )}
          </div>

          {/* 视频合成状态徽章（当视频已合成时显示） */}
          {scene.composedVideo && (
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-violet-500 rounded-full 
                          flex items-center justify-center border-2 border-white shadow-sm">
              <Film className="w-2 h-2 text-white" />
            </div>
          )}
        </div>

        {/* 标题和时长 */}
        <div className="flex-1 min-w-0">
          <h4 className={`font-semibold text-xs transition-colors flex items-center gap-1 ${
            selected ? 'text-violet-900' : 'text-gray-900 group-hover:text-violet-700'
          }`}>
            <span className={`inline-flex items-center justify-center w-4 h-4 rounded-md text-[9px] font-bold ${
              selected
                ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white'
                : 'bg-gradient-to-br from-gray-100 to-gray-200 text-gray-600'
            }`}>
              {index + 1}
            </span>
            {scene.title.length > 4 ? `${scene.title.substring(0, 4)}...` : scene.title}

            {/* 问号图标 */}
            {scene.content && (
              <div className="relative inline-flex items-start">
                <div
                  ref={helpIconRef}
                  className="inline-flex items-center"
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                >
                  <HelpCircle className="w-3 h-3 text-gray-400 cursor-help hover:text-violet-500 transition-colors" />
                </div>
              </div>
            )}
          </h4>
          {scene.scriptGenerated && scene.generatedScript && Number.isFinite(scene.duration) && scene.duration > 0 && (
            <div className="flex items-center gap-1 mt-0.5 text-[10px] text-gray-500">
              <Clock className="w-2.5 h-2.5" />
              <span>{scene.duration}秒</span>
            </div>
          )}
        </div>

        {/* 选中指示器 */}
        {selected && (
          <div className="flex-shrink-0">
            <div className="w-5 h-5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center shadow-sm">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* 脚本生成状态 */}
      <div className="px-2.5 pb-2.5">
        {scene.scriptGenerating ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 rounded-lg border border-blue-100">
            <Loader2 className="w-3 h-3 text-blue-600 animate-spin" />
            <span className="text-xs font-medium text-blue-700">生成中...</span>
          </div>
        ) : scene.scriptGenerated && scene.generatedScript ? (
          <button
            onClick={() => {
              console.log('[SceneListPanel] 点击查看脚本按钮:', {
                sceneId: scene.id,
                sceneTitle: scene.title,
                hasGeneratedScript: !!scene.generatedScript,
                generatedScript: scene.generatedScript,
              });
              onViewScript(scene.id);
            }}
            className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-gradient-to-r from-emerald-50 to-green-50 rounded-lg border border-emerald-100 hover:shadow-sm hover:shadow-emerald-100/50 transition-all duration-200"
          >
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span className="text-xs font-semibold text-emerald-700">查看脚本</span>
          </button>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 rounded-lg border border-gray-100">
            <Clock className="w-3 h-3 text-gray-400" />
            <span className="text-xs text-gray-500">等待生成</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function SceneListPanel({
  scenes,
  loading,
  generating,
  selectedId,
  onSelect,
  onGenerateAll,
  onViewScript,
}: SceneListPanelProps) {
  const [activeTooltip, setActiveTooltip] = useState<{ sceneId: string; content: string; position: { top: number; left: number } } | null>(null);
  // 添加调试日志
  useEffect(() => {
    console.log('[SceneListPanel] 当前显示的分镜数量:', scenes.length);
    console.log('[SceneListPanel] 分镜列表:', scenes.map(s => ({
      id: s.id,
      title: s.title,
      scriptGenerated: s.scriptGenerated,
      hasGeneratedScript: !!s.generatedScript,
      generatedScript: s.generatedScript,
    })));
  }, [scenes]);

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center py-8">
        <div className="relative">
          <div className="absolute inset-0 bg-violet-200 rounded-full blur-lg animate-pulse" />
          <div className="relative w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="mt-3 text-xs font-medium text-gray-600">加载分镜中...</p>
      </div>
    );
  }

  if (scenes.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center py-8 text-center">
        <div className="w-12 h-12 mb-3 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center shadow-inner">
          <Film className="w-6 h-6 text-gray-400" />
        </div>
        <p className="text-xs text-gray-600 font-semibold mb-1">暂无分镜</p>
        <p className="text-[10px] text-gray-500">请选择一个脚本大纲</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 头部 - 标题和生成按钮 */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Film className="w-2.5 h-2.5 text-white" />
          </div>
          <h3 className="text-xs font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
            分镜列表
          </h3>
          <span className="px-1.5 py-0.5 bg-violet-100 text-violet-700 text-[9px] font-bold rounded-full">
            {scenes.length}
          </span>
        </div>
        <button
          onClick={onGenerateAll}
          disabled={generating || scenes.length === 0}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-300 ${
            generating
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-violet-500 to-purple-600 text-white hover:shadow-md hover:shadow-violet-200/50'
          }`}
        >
          {generating ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              生成中...
            </>
          ) : (
            <>
              <Zap className="w-3 h-3" />
              生成分镜脚本
            </>
          )}
        </button>
      </div>

      {/* 分镜列表 */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 pb-2">
        {scenes.map((scene, index) => (
          <SceneCard
            key={scene.id}
            scene={scene}
            index={index}
            selected={selectedId === scene.id}
            onSelect={onSelect}
            onViewScript={onViewScript}
            activeTooltip={activeTooltip}
            setActiveTooltip={setActiveTooltip}
          />
        ))}
      </div>

      {/* 统一的悬浮提示框 */}
      {activeTooltip &&
        createPortal(
          <div
            className="fixed z-[9999] w-80 max-h-96"
            style={{
              top: `${activeTooltip.position.top}px`,
              left: `${activeTooltip.position.left}px`,
            }}
            onMouseEnter={() => setActiveTooltip(activeTooltip)}
            onMouseLeave={() => setActiveTooltip(null)}
          >
            <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-2xl border border-gray-700 overflow-y-auto max-h-80">
              <p className="leading-relaxed whitespace-pre-wrap">{activeTooltip.content}</p>
              {/* 小三角 */}
              <div className="absolute -top-1 left-3 w-2 h-2 bg-gray-900 transform rotate-45 border-t border-l border-gray-700"></div>
            </div>
          </div>,
          document.body
        )
      }
    </div>
  );
}
