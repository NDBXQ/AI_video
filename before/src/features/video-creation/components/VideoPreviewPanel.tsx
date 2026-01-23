/**
 * VideoPreviewPanel - 视频预览面板（现代化设计）
 * 支持连续播放和无视频模拟
 */

import { useEffect, useRef, useState } from 'react';
import { Scene } from '../domain/types';
import { formatTime } from '../domain/validators';
import { Play, Pause, Film, Volume2, Maximize2, Monitor, Settings } from 'lucide-react';
import { UsePlaybackReturn } from '../hooks/usePlayback';

interface VideoPreviewPanelProps {
  selectedScene: Scene | null;
  playback: UsePlaybackReturn;
}

export function VideoPreviewPanel({
  selectedScene,
  playback,
}: VideoPreviewPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoLoadError, setVideoLoadError] = useState(false);
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false);
  const [videoDurationSeconds, setVideoDurationSeconds] = useState<number | null>(null);
  const {
    isPlaying,
    currentTime,
    playlist,
    currentSceneIndex,
    playNext,
    updateCurrentTime,
    togglePlay,
  } = playback;

  const currentVideo = playlist[currentSceneIndex];
  const hasVideo = currentVideo?.hasVideo && !videoLoadError;
  const videoUrl = currentVideo?.url;
  const posterUrl = currentVideo?.thumbnail;
  const fallbackDuration = currentVideo?.duration ?? 0;
  const effectiveDuration =
    typeof videoDurationSeconds === 'number' && Number.isFinite(videoDurationSeconds) && videoDurationSeconds > 0
      ? videoDurationSeconds
      : fallbackDuration;

  useEffect(() => {
    setVideoLoadError(false);
    setShouldLoadVideo(false);
    setVideoDurationSeconds(null);
  }, [currentSceneIndex, videoUrl]);

  // 控制视频播放/暂停
  useEffect(() => {
    if (hasVideo && videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(console.error);
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying, hasVideo, currentSceneIndex]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
    }
  }, [videoUrl]);

  const handleTogglePlay = () => {
    if (!isPlaying) {
      setShouldLoadVideo(true);
    }
    togglePlay();
  };

  // 处理无视频时的模拟播放
  useEffect(() => {
    let interval: NodeJS.Timeout;
    let startTime: number;
    let initialTime = 0;

    if (!hasVideo && isPlaying && currentVideo) {
      if (!(fallbackDuration > 0)) return;
      console.log('[VideoPreview] 开始模拟播放分镜:', currentSceneIndex);
      startTime = Date.now();
      initialTime = currentTime;

      interval = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        const newTime = initialTime + elapsed;

        if (newTime >= fallbackDuration) {
          console.log('[VideoPreview] 模拟播放结束, 切换下一个');
          updateCurrentTime(fallbackDuration);
          playNext();
          clearInterval(interval);
        } else {
          updateCurrentTime(newTime);
        }
      }, 100);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [hasVideo, isPlaying, currentVideo, fallbackDuration, playNext, updateCurrentTime, currentSceneIndex]); // 移除 currentTime 依赖，避免死循环

  const handleVideoTimeUpdate = () => {
    if (videoRef.current) {
      updateCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleVideoLoadedMetadata = () => {
    const value = videoRef.current?.duration;
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      setVideoDurationSeconds(value);
    }
  };

  const handleVideoEnded = () => {
    console.log('[VideoPreview] 视频播放结束, 切换下一个');
    playNext();
  };

  return (
    <div className="h-full rounded-2xl border border-gray-200/60 bg-white/70 backdrop-blur-sm p-3 shadow-xl shadow-blue-100/50 flex flex-col">
      <div className="flex items-center gap-2 mb-2 flex-shrink-0">
        <div className="w-5 h-5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center">
          <Monitor className="w-2.5 h-2.5 text-white" />
        </div>
        <h3 className="text-xs font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
          视频预览
        </h3>
        {playlist.length > 0 && (
          <span className="px-1.5 py-0.5 bg-violet-100 text-violet-700 text-[9px] font-bold rounded-full">
            分镜 {currentSceneIndex + 1} / {playlist.length}
          </span>
        )}
      </div>

      <div className="flex-1 bg-gradient-to-br from-gray-900 via-slate-900 to-black rounded-xl overflow-hidden relative shadow-2xl min-h-0 group">
        {hasVideo && shouldLoadVideo ? (
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full object-contain"
            onTimeUpdate={handleVideoTimeUpdate}
            onLoadedMetadata={handleVideoLoadedMetadata}
            onEnded={handleVideoEnded}
            onError={() => setVideoLoadError(true)}
            preload="auto"
            // 不要自动播放，由 useEffect 控制
          />
        ) : hasVideo ? (
          posterUrl ? (
            <div className="relative w-full h-full">
              <img
                src={posterUrl}
                alt={selectedScene?.title || '视频首帧'}
                className="w-full h-full object-cover opacity-70"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-white font-bold text-lg drop-shadow-md">点击播放</p>
              </div>
            </div>
          ) : (
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full h-full object-contain"
              onError={() => setVideoLoadError(true)}
              onLoadedMetadata={(e) => {
                const value = e.currentTarget.duration;
                if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
                  setVideoDurationSeconds(value);
                }
                try {
                  e.currentTarget.currentTime = 0.01;
                  e.currentTarget.pause();
                } catch {}
              }}
              preload="metadata"
              muted
              playsInline
            />
          )
        ) : selectedScene ? (
          <div className="relative w-full h-full bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900">
            <div className="absolute inset-0 bg-white/5" />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-white font-bold text-lg drop-shadow-md">暂无视频</p>
              {fallbackDuration > 0 && (
                <p className="text-white/70 text-sm">
                  {formatTime(currentTime)} / {formatTime(fallbackDuration)}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900">
             {/* 空状态 */}
            <div className="relative mb-2">
              <div className="absolute inset-0 bg-violet-500/20 rounded-full blur-3xl animate-pulse" />
              <div className="relative w-12 h-12 bg-gradient-to-br from-violet-500/20 to-purple-600/20 rounded-xl flex items-center justify-center border border-violet-400/30">
                <Film className="w-6 h-6 text-violet-400" />
              </div>
            </div>
            <p className="text-white/90 text-sm font-semibold mb-0.5">开始视频创作</p>
            <p className="text-white/60 text-[10px]">选择一个脚本大纲开始</p>
          </div>
        )}

        {/* 播放控制覆盖层 (点击视频区域切换播放状态) */}
        {playlist.length > 0 && hasVideo && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <button
              type="button"
              className={`pointer-events-auto h-12 w-12 rounded-xl bg-white/20 backdrop-blur-md border-2 border-white/30 flex items-center justify-center hover:bg-white/30 hover:scale-110 transition-all duration-300 shadow-2xl ${
                isPlaying ? 'opacity-30 group-hover:opacity-100' : 'opacity-100'
              }`}
              onClick={handleTogglePlay}
              aria-label={isPlaying ? '暂停' : '播放'}
            >
              {isPlaying ? (
                <Pause className="h-6 w-6 text-white" />
              ) : (
                <Play className="h-6 w-6 text-white ml-0.5" />
              )}
            </button>
          </div>
        )}

        {/* 顶部工具栏 */}
        {selectedScene && (
          <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
            <button className="p-1 bg-black/50 backdrop-blur-md rounded hover:bg-black/70 transition-colors">
              <Volume2 className="w-3 h-3 text-white" />
            </button>
            <button className="p-1 bg-black/50 backdrop-blur-md rounded hover:bg-black/70 transition-colors">
              <Settings className="w-3 h-3 text-white" />
            </button>
            <button className="p-1 bg-black/50 backdrop-blur-md rounded hover:bg-black/70 transition-colors">
              <Maximize2 className="w-3 h-3 text-white" />
            </button>
          </div>
        )}

        {/* 时间码显示 */}
        {playlist.length > 0 && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10 pointer-events-none">
            <div className={`w-1 h-1 rounded-full ${isPlaying ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-white text-[10px] font-mono font-medium">
              {formatTime(currentTime)} / {formatTime(effectiveDuration)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
