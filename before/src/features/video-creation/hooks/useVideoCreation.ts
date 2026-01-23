/**
 * useVideoCreation Hook - 视频创作主Hook
 * 组合所有子Hooks，提供统一的API
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useStories } from './useStories';
import { useScenes } from './useScenes';
import { usePlayback } from './usePlayback';
import { useSynthesis } from './useSynthesis';
import { useSceneScripts } from './useSceneScripts';
import { StoryService } from '../services';
import { OutlineData, TimelineVideoData } from '../domain/types';

export function useVideoCreation(storyId?: string | null) {
  // 故事管理
  const { stories, loading: loadingStories, refetch: refetchStories } = useStories(storyId);

  // 分镜管理
  const { scenes, loading: loadingScenes, loadScenes, clearScenes, setScenes, currentStory } = useScenes();

  // 播放控制
  const playback = usePlayback();
  const { updatePlaylist, reset: playbackReset, playScene } = playback;

  // 视频合成
  const synthesis = useSynthesis();
  const { reset: synthesisReset, startSynthesis } = synthesis;

  // 选择状态
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [selectedOutlineId, setSelectedOutlineId] = useState<string | null>(null);
  const [selectedStoryboardId, setSelectedStoryboardId] = useState<string | null>(null);

  // 错误状态
  const [error, setError] = useState<string | null>(null);

  // 自动选中第一个分镜
  useEffect(() => {
    // 只有当分镜列表有数据，且当前没有选中分镜时，才自动选中第一个
    const selectedExists = selectedStoryboardId
      ? scenes.some((s) => s.id === selectedStoryboardId)
      : false;
    if (scenes.length > 0 && (!selectedStoryboardId || !selectedExists)) {
      const firstStoryboardId = scenes[0].id;
      // console.log('[useVideoCreation] 自动选中第一个分镜:', firstStoryboardId);
      setSelectedStoryboardId(firstStoryboardId);
    }
  }, [scenes, selectedStoryboardId]);

  // 分镜脚本生成状态
  const {
    scriptGenerating,
    showScriptModal,
    selectedScriptScene,
    handleGenerateScripts,
    handleViewScript,
    handleCloseScriptModal,
  } = useSceneScripts({ scenes, setScenes, setError });

  // 清除错误
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // 监听大纲选择变化，加载数据
  useEffect(() => {
    const loadOutlineData = async () => {
      if (!selectedOutlineId) return;

      console.log('[useVideoCreation] 切换大纲，开始加载数据:', selectedOutlineId);

      try {
        // 1. 加载分镜
        await loadScenes({ outlineId: selectedOutlineId });

        // 2. 加载时间线视频数据
        const timelineScenes: TimelineVideoData[] = await StoryService.fetchTimeline(selectedOutlineId);

        if (timelineScenes && timelineScenes.length > 0) {
           const videos = timelineScenes.map((item: any) => ({
             storyboardId: item.storyboardId,
             title: item.sceneTitle,
             sequence: item.sequence,
             url: item.video?.playUrl || item.video?.url || '',
             duration: item.video?.duration || 3,
             hasVideo: !!(item.video?.playUrl || item.video?.url),
             thumbnail: item.video?.thumbnailPlayUrl || item.video?.thumbnailUrl || item.video?.playUrl || item.video?.url
           }));
           updatePlaylist(videos);
           console.log('[useVideoCreation] 更新播放列表:', videos.length, '个视频');
        } else {
           updatePlaylist([]);
        }
      } catch (err) {
        console.error('[useVideoCreation] 加载数据失败:', err);
        setError('加载大纲数据失败，请重试');
        updatePlaylist([]);
      }
    };

    loadOutlineData();
  }, [selectedOutlineId, loadScenes, updatePlaylist]);

  // 选择故事
  const handleStorySelect = useCallback(async (storyId: string) => {
    setSelectedStoryId(storyId);
    setSelectedOutlineId(null);
    setSelectedStoryboardId(null);
    playbackReset();
    synthesisReset();
    // 注意：如果在Story维度下也需要加载分镜，这里可以调用 loadScenes({ storyId })
    // 但根据目前逻辑，主要是选择Outline后才加载分镜
    // await loadScenes({ storyId });
  }, [playbackReset, synthesisReset]);

  // 选择大纲
  const handleOutlineSelect = useCallback((outline: OutlineData) => {
    console.log('[useVideoCreation] handleOutlineSelect 被调用，大纲ID:', outline.id);

    clearScenes();
    setSelectedOutlineId(outline.id);
    setSelectedStoryboardId(null);
    playbackReset();
    // 数据加载逻辑已移至 useEffect
  }, [clearScenes, playbackReset]);

  // 自动选中第一个大纲
  const initializedRef = useRef(false);
  useEffect(() => {
    // 只有当故事列表有数据，且尚未初始化选择时，才自动选中第一个
    if (!initializedRef.current && stories.length > 0 && !selectedOutlineId) {
      // 遍历故事，找到第一个有大纲的故事
      const firstStoryWithOutlines = stories.find(s => s.outlines && s.outlines.length > 0);
      
      if (firstStoryWithOutlines && firstStoryWithOutlines.outlines && firstStoryWithOutlines.outlines.length > 0) {
        const firstOutline = firstStoryWithOutlines.outlines[0];
        console.log('[useVideoCreation] 自动选中第一个大纲:', firstOutline.id);
        handleOutlineSelect(firstOutline);
        initializedRef.current = true;
      }
    }
  }, [stories, selectedOutlineId, handleOutlineSelect]);

  // 选择分镜
  const handleSceneSelect = useCallback((storyboardId: string) => {
    setSelectedStoryboardId(storyboardId);
    const sceneIndex = scenes.findIndex((s) => s.id === storyboardId);
    if (sceneIndex !== -1) {
      playScene(sceneIndex);
    }
  }, [scenes, playScene]);

  // 开始合成
  const handleStartSynthesis = useCallback(async () => {
    if (!selectedStoryId) return;

    try {
      await startSynthesis();
    } catch (error) {
      console.error('视频合成失败:', error);
      setError('视频合成启动失败');
    }
  }, [selectedStoryId, startSynthesis]);

  // 下载视频
  const handleDownload = useCallback(() => {
    console.log('下载视频');
  }, []);

  // 重置所有状态
  const resetAll = useCallback(() => {
    setSelectedStoryId(null);
    setSelectedOutlineId(null);
    setSelectedStoryboardId(null);
    clearScenes();
    playback.reset();
    synthesis.reset();
    setError(null);
    initializedRef.current = false; // 重置初始化标记
  }, [clearScenes, playback, synthesis]);

  return {
    // 故事相关
    stories,
    loadingStories,
    selectedStoryId,
    handleStorySelect,

    // 大纲相关
    selectedOutlineId,
    handleOutlineSelect,

    // 分镜相关
    scenes,
    loadingScenes,
    loadScenes,
    currentStory,
    selectedStoryboardId,
    handleSceneSelect,

    // 播放相关
    playback,

    // 合成相关
    synthesis,
    handleStartSynthesis,
    handleDownload,

    // 分镜脚本生成相关
    scriptGenerating,
    showScriptModal,
    selectedScriptScene,
    handleGenerateScripts,
    handleViewScript,
    handleCloseScriptModal,

    // 错误处理
    error,
    clearError,

    // 通用
    resetAll,
    refetchStories,
  };
}

export type UseVideoCreationReturn = ReturnType<typeof useVideoCreation>;
