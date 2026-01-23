/**
 * VideoLibrary - 视频素材库组件
 * 展示合成的视频，支持合成操作
 */

'use client';

import { useState } from 'react';
import {
  Video as VideoIcon,
  Play,
  Pause,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  Volume2,
  Maximize,
  Download,
  FileText,
} from 'lucide-react';
import { Scene } from '../domain/types';
import { PromptModal } from './PromptModal';

interface VideoLibraryProps {
  scene: Scene | null;
  onCompose?: (options?: { forceRegenerate?: boolean }) => Promise<string>;
  composed?: boolean;
  composing?: boolean;
  composedVideoUrl?: string;
  videoMode?: '首帧' | '尾帧';
  onVideoModeChange?: (mode: '首帧' | '尾帧') => void;
}

// 视频播放器组件
function VideoPlayer({
  videoUrl,
  thumbnailUrl,
  duration,
  onPreview,
}: {
  videoUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  onPreview?: () => void;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration_, setDuration_] = useState<number | undefined>(duration);

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    setCurrentTime(video.currentTime);
  };

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    if (!duration) {
      setDuration_(video.duration);
    }
  };

  const handleError = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    const mediaError = video.error;
    console.error('[VideoPlayer] 视频加载失败', {
      src: video.currentSrc || videoUrl,
      code: mediaError?.code,
      message: mediaError?.message,
      networkState: video.networkState,
      readyState: video.readyState,
    });
  };

  if (!videoUrl) {
    return (
      <div className="aspect-video bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <VideoIcon className="w-12 h-12 text-gray-300" />
      </div>
    );
  }

  return (
    <div className="aspect-video relative bg-black rounded-lg overflow-hidden group">
      {/* 原生视频元素 */}
      <video
        src={videoUrl}
        controls
        preload="metadata"
        className="w-full h-full object-cover"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onError={handleError}
        poster={thumbnailUrl}
      />

      {/* 已生成标签 */}
      {isPlaying && (
        <div className="absolute top-2 left-2 px-2 py-1 bg-gradient-to-r from-emerald-500 to-green-500 text-white text-[10px] font-bold rounded-full shadow-md flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          已生成
        </div>
      )}
    </div>
  );
}

export function VideoLibrary({
  scene,
  onCompose,
  composed = false,
  composing = false,
  composedVideoUrl,
  videoMode = '首帧',
  onVideoModeChange,
}: VideoLibraryProps) {
  const handleCompose = async () => {
    if (onCompose) {
      try {
        await onCompose({ forceRegenerate: composed });
      } catch {}
    }
  };

  // 提示词Modal展开状态
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);

  // 解析视频时长和提示词（从数据库获取）
  const videoDuration = scene?.duration || 15;
  const videoPrompt = scene?.videoPrompt || '请先生成提示词';

  // 调试日志
  console.log('[VideoLibrary] ========== 渲染组件 ==========');
  console.log('[VideoLibrary] scene:', scene);
  console.log('[VideoLibrary] scene.id:', scene?.id);
  console.log('[VideoLibrary] scene.title:', scene?.title);
  console.log('[VideoLibrary] scene.generatedScript:', scene?.generatedScript);
  console.log('[VideoLibrary] composed:', composed);
  console.log('[VideoLibrary] composing:', composing);
  console.log('[VideoLibrary] composedVideoUrl:', composedVideoUrl);
  console.log('[VideoLibrary] has generatedScript:', !!scene?.generatedScript);
  console.log('[VideoLibrary] has scene:', !!scene);
  console.log('[VideoLibrary] should show button:', !composed);
  console.log('[VideoLibrary] should show scene content:', !!scene);
  console.log('[VideoLibrary] =================================');

  return (
    <div className="flex flex-col h-full gap-2">
      {!scene ? (
        <div className="flex-1 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center p-8">
          <div className="text-center">
            <VideoIcon className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-500">请先选择一个分镜</p>
          </div>
        </div>
      ) : (
        <>
          {/* 视频生成模式选择 */}
          {!composed && (
            <div className="flex gap-1 mb-1.5">
              <button
                onClick={() => onVideoModeChange?.('首帧')}
                className={`flex-1 px-2 py-1 rounded-md text-xs font-semibold transition-all ${
                  videoMode === '首帧'
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                首帧模式
              </button>
              <button
                onClick={() => onVideoModeChange?.('尾帧')}
                className={`flex-1 px-2 py-1 rounded-md text-xs font-semibold transition-all ${
                  videoMode === '尾帧'
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                尾帧模式
              </button>
            </div>
          )}

          {/* 操作按钮区域 - 移到视频预览前 */}
          <div className="flex gap-1.5 mb-2">
            {/* AI合成视频按钮始终显示 */}
            <button
              onClick={handleCompose}
              disabled={composing || !scene.generatedScript}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-semibold transition-all ${
                composing || !scene.generatedScript
                  ? 'bg-blue-200 text-blue-500 border border-blue-300 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white border border-blue-400 hover:shadow-xs hover:shadow-blue-200/30'
              }`}
            >
              {composing ? (
                <>
                  <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                  合成中...
                </>
              ) : composed ? (
                <>
                  <Sparkles className="w-2.5 h-2.5" />
                  重新合成
                </>
              ) : (
                <>
                  <Sparkles className="w-2.5 h-2.5" />
                  AI合成视频
                </>
              )}
            </button>
            
            {/* 导出视频按钮 - 仅在合成完成后显示 */}
            {composed && (
              <button className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md bg-gradient-to-r from-blue-500 to-cyan-600 text-white text-xs font-semibold hover:shadow-xs transition-all">
                <Download className="w-2.5 h-2.5" />
                导出视频
              </button>
            )}
          </div>

          {/* 视频预览区域 */}
          <div className="flex-1 min-h-0">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1">
                <span className="text-xs font-semibold text-gray-700">视频预览</span>
                {composed && (
                  <span className="px-1 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-semibold rounded-full">
                    已就绪
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {/* 查看提示词按钮 */}
                <button
                  onClick={() => setIsPromptModalOpen(true)}
                  disabled={!scene.videoPrompt}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all ${
                    !scene.videoPrompt
                      ? 'opacity-50 cursor-not-allowed bg-gray-100 text-gray-400'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  查看提示词
                </button>
                {/* 音量和全屏按钮 */}
                {composedVideoUrl && (
                  <div className="flex items-center gap-0.5">
                    <button className="p-0.5 hover:bg-gray-100 rounded-md transition-colors" title="音量">
                      <Volume2 className="w-3 h-3 text-gray-500" />
                    </button>
                    <button className="p-0.5 hover:bg-gray-100 rounded-md transition-colors" title="全屏">
                      <Maximize className="w-3 h-3 text-gray-500" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="w-full aspect-video rounded-lg overflow-hidden">
              <VideoPlayer
                videoUrl={composedVideoUrl}
                thumbnailUrl={scene.thumbnail}
                duration={videoDuration}
              />
            </div>
          </div>

          {/* 提示词Modal */}
          <PromptModal
            isOpen={isPromptModalOpen}
            prompt={scene.videoPrompt}
            onClose={() => setIsPromptModalOpen(false)}
          />
        </>
      )}
    </div>
  );
}
