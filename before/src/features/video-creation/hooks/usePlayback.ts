/**
 * usePlayback Hook - 管理播放控制
 */

import { useState, useCallback, useRef } from 'react';
import { Scene } from '../domain/types';

export interface TimelineVideo {
  storyboardId: string;
  title: string;
  sequence: number;
  url?: string;
  duration: number; // 视频时长或模拟时长
  hasVideo: boolean;
  thumbnail?: string;
}

export function usePlayback() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0); // 当前分镜内的播放时间
  const [playlist, setPlaylist] = useState<TimelineVideo[]>([]);

  // 更新播放列表
  const updatePlaylist = useCallback((videos: TimelineVideo[]) => {
    setPlaylist(videos);
    setCurrentSceneIndex(0);
    setCurrentTime(0);
    setIsPlaying(false);
  }, []);

  // 播放/暂停
  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const play = useCallback(() => {
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  // 切换分镜
  const playScene = useCallback((index: number) => {
    if (index >= 0 && index < playlist.length) {
      setCurrentSceneIndex(index);
      setCurrentTime(0);
      setIsPlaying(true);
    }
  }, [playlist.length]);

  const playNext = useCallback(() => {
    if (currentSceneIndex < playlist.length - 1) {
      setCurrentSceneIndex((prev) => prev + 1);
      setCurrentTime(0);
      // 保持播放状态
    } else {
      // 播放结束
      setIsPlaying(false);
      setCurrentSceneIndex(0);
      setCurrentTime(0);
    }
  }, [currentSceneIndex, playlist.length]);

  const playPrevious = useCallback(() => {
    if (currentSceneIndex > 0) {
      setCurrentSceneIndex((prev) => prev - 1);
      setCurrentTime(0);
      setIsPlaying(true);
    }
  }, [currentSceneIndex]);

  // 更新当前时间（由 VideoPreviewPanel 调用）
  const updateCurrentTime = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  // 重置
  const reset = useCallback(() => {
    setIsPlaying(false);
    setCurrentSceneIndex(0);
    setCurrentTime(0);
  }, []);

  return {
    isPlaying,
    currentSceneIndex,
    currentTime, // 当前分镜的时间
    playlist,
    updatePlaylist,
    togglePlay,
    play,
    pause,
    playScene,
    playNext,
    playPrevious,
    updateCurrentTime,
    reset,
  };
}

export type UsePlaybackReturn = ReturnType<typeof usePlayback>;
