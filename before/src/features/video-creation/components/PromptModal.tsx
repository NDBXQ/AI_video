'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FileText, X, Copy, CheckCircle2 } from 'lucide-react';

interface PromptModalProps {
  isOpen: boolean;
  prompt?: string | null;
  onClose: () => void;
}

/**
 * PromptModal - 提示词详情Modal组件
 * 使用React Portal渲染到document.body，避免层级问题
 */
export function PromptModal({ isOpen, prompt, onClose }: PromptModalProps) {
  const [copySuccess, setCopySuccess] = useState(false);

  // 复制提示词
  const handleCopyPrompt = async () => {
    if (prompt) {
      try {
        await navigator.clipboard.writeText(prompt);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (error) {
        console.error('复制失败:', error);
      }
    }
  };

  // 处理键盘事件（ESC关闭）
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // 禁止body滚动
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // 点击遮罩层关闭
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={handleBackdropClick}
    >
      <div
        className="w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden transform transition-all duration-200 ease-out"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-blue-500 to-cyan-600">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-white" />
            <span className="text-sm font-bold text-white">提示词详情</span>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors rounded-md p-1 hover:bg-white/10"
            title="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内容区域 */}
        <div className="p-5">
          {prompt ? (
            <>
              {/* 提示词内容 */}
              <div className="mb-4">
                <div className="h-64 overflow-y-auto p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
                    {prompt}
                  </p>
                </div>
              </div>

              {/* 复制按钮 */}
              <button
                onClick={handleCopyPrompt}
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold transition-all ${
                  copySuccess
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200'
                    : 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white hover:shadow-lg hover:shadow-blue-200/30'
                }`}
              >
                {copySuccess ? (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    已复制到剪贴板
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5" />
                    复制提示词
                  </>
                )}
              </button>
            </>
          ) : (
            // 无提示词占位
            <div className="h-64 flex flex-col items-center justify-center bg-gray-50 rounded-lg border border-gray-200">
              <FileText className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-sm text-gray-400 italic">暂无提示词</p>
              <p className="text-xs text-gray-400 mt-1">请先生成提示词</p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
