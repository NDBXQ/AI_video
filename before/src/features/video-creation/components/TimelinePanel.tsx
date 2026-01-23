/**
 * TimelinePanel - 时间线面板（现代化设计）
 * 纯展示组件，状态由 usePlayback 管理
 */

'use client';

import { Button } from '@/components/ui/button';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Clock,
  Plus,
  Trash2,
  Scissors,
} from 'lucide-react';
import { UsePlaybackReturn } from '../hooks/usePlayback';

interface TimelinePanelProps {
  playback: UsePlaybackReturn;
  onSceneClick: (id: string) => void;
  selectedStoryboardId: string | null;
}

export function TimelinePanel({
  playback,
  onSceneClick,
  selectedStoryboardId,
}: TimelinePanelProps) {
  const {
    playlist,
    currentSceneIndex,
    currentTime,
    isPlaying,
    togglePlay,
    playNext,
    playPrevious,
  } = playback;

  // 计算当前分镜的播放进度
  const currentDuration = playlist[currentSceneIndex]?.duration || 1;
  const progress = Math.min(100, Math.max(0, (currentTime / currentDuration) * 100));

  /**
   * 生成视频第一帧缩略图
   */
  const generateThumbnail = (url: string | undefined, thumbnail: string | undefined): string => {
    if (thumbnail) return thumbnail;
    if (url) return url;
    return ''; // 占位符
  };

  /**
   * 点击场景
   */
  const handleSceneClick = (sceneId: string, index: number) => {
    onSceneClick(sceneId);
    playback.playScene(index);
  };

  return (
    <div className="h-full rounded-2xl border border-gray-200/60 bg-white/70 backdrop-blur-sm p-3 overflow-hidden flex flex-col shadow-xl shadow-blue-100/50 min-h-0">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Clock className="w-2.5 h-2.5 text-white" />
          </div>
          <h3 className="text-xs font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
            时间线
          </h3>
          {playlist.length > 0 && (
            <span className="px-1.5 py-0.5 bg-violet-100 text-violet-700 text-[9px] font-bold rounded-full">
              {currentSceneIndex + 1} / {playlist.length}
            </span>
          )}
        </div>
        <div className="flex gap-1.5">
          <Button size="sm" variant="secondary" className="h-6 px-2 hover:bg-violet-50 hover:border-violet-200 transition-colors text-[10px]">
            <Plus className="w-3 h-3 mr-0.5" />
            添加
          </Button>
          <Button size="sm" variant="secondary" className="h-6 px-2 hover:bg-red-50 hover:border-red-200 transition-colors text-red-600 hover:text-red-700 text-[10px]">
            <Trash2 className="w-3 h-3 mr-0.5" />
            删除
          </Button>
        </div>
      </div>

      {/* 播放控制 */}
      {playlist.length > 0 && (
        <div className="flex items-center gap-2 mb-2 flex-shrink-0 bg-gradient-to-r from-violet-50 to-purple-50 rounded-lg p-2">
          <Button
            size="sm"
            onClick={playPrevious}
            disabled={currentSceneIndex === 0}
            className="h-7 w-7 p-0 rounded-lg hover:bg-violet-100 transition-colors"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="sm"
            onClick={togglePlay}
            disabled={playlist.length === 0}
            className="h-7 w-7 p-0 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 hover:shadow-lg transition-all"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 text-white" /> : <Play className="w-3.5 h-3.5 text-white" />}
          </Button>
          <Button
            size="sm"
            onClick={playNext}
            disabled={currentSceneIndex === playlist.length - 1}
            className="h-7 w-7 p-0 rounded-lg hover:bg-violet-100 transition-colors"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </Button>
          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-purple-600 transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[10px] text-gray-600 font-medium">
            {Math.floor(progress)}%
          </span>
        </div>
      )}

      {/* 时间轴内容 */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden min-h-0">
        {playlist.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-gray-400 text-xs">暂无时间线数据</div>
          </div>
        ) : (
          <div className="flex gap-2 min-w-max p-1.5">
            {playlist.map((item, index) => {
              const isSelected = item.storyboardId === selectedStoryboardId;
              const isCurrent = index === currentSceneIndex;
              const thumbnail = generateThumbnail(item.url, item.thumbnail);

              return (
                <div
                  key={item.storyboardId}
                  onClick={() => handleSceneClick(item.storyboardId, index)}
                  className={`relative flex-shrink-0 rounded-lg overflow-hidden cursor-pointer transition-all duration-300 group ${
                    isCurrent
                      ? 'ring-3 ring-violet-500 ring-offset-2 shadow-xl shadow-violet-200/50'
                      : isSelected
                      ? 'ring-2 ring-violet-400 ring-offset-1 shadow-lg'
                      : 'ring-2 ring-transparent hover:ring-violet-300 hover:ring-offset-1 hover:shadow-md'
                  }`}
                  style={{
                    width: '160px',
                    height: '90px',
                  }}
                >
                  {/* 缩略图/视频预览 */}
                  {thumbnail ? (
                    item.hasVideo ? (
                      <video
                        src={item.url}
                        className="w-full h-full object-cover"
                        poster={thumbnail}
                        muted // 缩略图静音
                        // 不自动播放，只展示第一帧
                      />
                    ) : (
                      <div className="relative w-full h-full">
                        <img 
                          src={thumbnail}
                          alt={item.title}
                          className="w-full h-full object-cover opacity-70"
                        />
                         <div className="absolute inset-0 flex items-center justify-center">
                             <div className="px-2 py-1 bg-black/40 rounded text-white text-[10px]">无视频</div>
                         </div>
                      </div>
                    )
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-[8px] text-gray-400 font-medium">暂无预览</div>
                      </div>
                    </div>
                  )}

                  {/* 播放进度指示器 */}
                  {isCurrent && (
                    <div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-violet-500/70 to-purple-500/70 backdrop-blur-sm transition-all duration-200 pointer-events-none"
                      style={{ width: `${progress}%` }}
                    />
                  )}

                  {/* 当前播放指示器 */}
                  {isCurrent && (
                    <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-gradient-to-r from-emerald-500 to-green-500 text-white text-[9px] font-bold rounded-full shadow-md z-10">
                      播放中
                    </div>
                  )}

                  {/* 悬浮工具栏 */}
                  <div className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20">
                    <button className="p-0.5 bg-black/60 backdrop-blur-md rounded hover:bg-black/80 transition-colors">
                      <Scissors className="w-2 h-2 text-white" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
