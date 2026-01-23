/**
 * AudioLibrary - 音频素材库组件
 * 支持试听合成的音频，支持合成操作
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Music as MusicIcon,
  Play,
  Pause,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  Volume2,
  Download,
  SkipForward,
  SkipBack,
} from 'lucide-react';
import { Scene } from '../domain/types';

interface AudioLibraryProps {
  scene: Scene | null;
  onCompose?: () => Promise<string>;
  composed?: boolean;
  composing?: boolean;
  composedAudioUrl?: string;
}

// 音频播放器组件
function AudioPlayer({
  audioUrl,
  duration,
}: {
  audioUrl?: string;
  duration?: number;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play();
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const totalDuration = duration || 10;

  if (!audioUrl) {
    return (
      <div className="h-24 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg flex items-center justify-center">
        <MusicIcon className="w-10 h-10 text-gray-300" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <audio ref={audioRef} src={audioUrl} />

      {/* 波形可视化（静态） */}
      <div className="h-24 bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg border border-orange-200 overflow-hidden flex items-center justify-center px-4">
        <div className="flex items-end gap-0.5 h-16">
          {[...Array(30)].map((_, i) => {
            const height = 20 + ((i * 37) % 41);
            return (
              <div
                key={i}
                className={`w-1 rounded-full transition-all duration-300 ${
                  isPlaying ? 'bg-gradient-to-t from-orange-400 to-amber-400' : 'bg-orange-300'
                }`}
                style={{
                  height: `${height}%`,
                  animation: isPlaying ? `pulse 0.5s ease-in-out infinite ${i * 0.05}s` : 'none',
                }}
              />
            );
          })}
        </div>
      </div>

      {/* 控制条 */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
        {/* 时间轴 */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 w-10 text-right">{formatTime(currentTime)}</span>
          <input
            type="range"
            min="0"
            max={totalDuration}
            step="0.1"
            value={currentTime}
            onChange={handleSeek}
            className="flex-1 h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-orange-500"
          />
          <span className="text-xs text-gray-500 w-10">{formatTime(totalDuration)}</span>
        </div>

        {/* 控制按钮 */}
        <div className="flex items-center justify-center gap-4">
          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="后退">
            <SkipBack className="w-4 h-4 text-gray-600" />
          </button>

          <button
            onClick={handlePlayPause}
            className="w-12 h-12 bg-gradient-to-r from-orange-500 to-amber-600 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all"
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 text-white ml-0.5" />
            ) : (
              <Play className="w-6 h-6 text-white ml-1" />
            )}
          </button>

          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="前进">
            <SkipForward className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function AudioLibrary({
  scene,
  onCompose,
  composed = false,
  composing = false,
  composedAudioUrl,
}: AudioLibraryProps) {
  const handleCompose = async () => {
    if (onCompose) {
      await onCompose();
    }
  };

  // 解析音频内容和提示词
  const audioContent = scene?.generatedScript?.speak?.content || '';
  const audioSpeaker = scene?.generatedScript?.speak?.speaker || '';
  const audioPrompt = audioSpeaker
    ? `说话人：${audioSpeaker}，内容：${audioContent.substring(0, 50)}...`
    : '请先生成分镜脚本';

  return (
    <div className="flex flex-col h-full gap-2">
      {!scene ? (
        <div className="flex-1 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center p-8">
          <div className="text-center">
            <MusicIcon className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-500">请先选择一个分镜</p>
          </div>
        </div>
      ) : (
        <>
          {/* 音频播放器区域 */}
          <div>
            <div className="flex items-center gap-1 mb-1.5">
              <span className="text-xs font-semibold text-gray-700">音频试听</span>
              {composed && (
                <span className="px-1 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-semibold rounded-full">
                  已就绪
                </span>
              )}
            </div>

            <AudioPlayer
              audioUrl={composedAudioUrl}
              duration={scene.duration}
            />
          </div>

          {/* 提示词区域 */}
          {scene.generatedScript && !composed && (
            <div className="p-2 rounded-md bg-orange-50/80 border border-orange-200/80">
              <div className="flex items-start gap-1.5 mb-1">
                <Volume2 className="w-3 h-3 text-orange-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-semibold text-orange-700 mb-0.5">合成提示：</p>
                  <p className="text-[10px] text-orange-700 leading-relaxed">{audioPrompt}</p>
                </div>
              </div>
              {audioContent && (
                <div className="mt-1.5 pt-1.5 border-t border-orange-200/50">
                  <p className="text-[10px] text-orange-600 italic">
                    &quot;{audioContent.substring(0, 80)}...&quot;
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 合成按钮 */}
          {!composed && (
            <div className="p-2 rounded-lg bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200">
              <button
                onClick={handleCompose}
                disabled={composing || !scene.generatedScript}
                className={`w-full flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  composing || !scene.generatedScript
                    ? 'bg-orange-200 text-orange-500 cursor-not-allowed border border-orange-300'
                    : 'bg-gradient-to-r from-orange-500 to-amber-600 text-white hover:shadow-xs hover:shadow-orange-200/50 border border-orange-400/30'
                }`}
              >
                {composing ? (
                  <>
                    <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                    合成中...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-2.5 h-2.5" />
                    AI合成音频
                  </>
                )}
              </button>
              {!scene.generatedScript && (
                <p className="text-[10px] text-orange-600 text-center mt-1">
                  请先生成分镜脚本
                </p>
              )}
            </div>
          )}

          {/* 已合成状态操作 */}
          {composed && (
            <div className="flex gap-1.5">
              <button
                onClick={handleCompose}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-orange-300 text-orange-600 text-xs font-semibold hover:bg-orange-50 transition-all"
              >
                <RefreshCw className="w-3 h-3" />
                重新合成
              </button>
              <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-amber-600 text-white text-xs font-semibold hover:shadow-sm transition-all">
                <Download className="w-3 h-3" />
                导出音频
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
