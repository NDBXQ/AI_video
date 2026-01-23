'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useVideoCreation } from '@/features/video-creation/hooks';
import { OutlineListPanel, SceneListPanel, MediaLibrary, VideoPreviewPanel, TimelinePanel } from '@/features/video-creation/components';
import { ScriptResultModal } from '@/features/video-creation/components/ScriptResultModal';

export function VideoCreationClient() {
  const searchParams = useSearchParams();
  const storyId = searchParams.get('storyId');

  const {
    stories,
    loadingStories,
    selectedOutlineId,
    handleOutlineSelect,
    scenes,
    loadingScenes,
    loadScenes,
    selectedStoryboardId,
    handleSceneSelect,
    playback,
    synthesis,
    handleDownload,
    scriptGenerating,
    showScriptModal,
    selectedScriptScene,
    handleGenerateScripts,
    handleViewScript,
    handleCloseScriptModal,
    error,
    clearError,
  } = useVideoCreation(storyId);

  const selectedScene = scenes.find((s: any) => s.id === selectedStoryboardId) || null;
  const handleRefreshScenes = useCallback(async () => {
    if (selectedOutlineId) {
      await loadScenes({ outlineId: selectedOutlineId });
      return;
    }
    if (storyId) {
      await loadScenes(storyId);
    }
  }, [loadScenes, selectedOutlineId, storyId]);

  return (
    <>
      {error && (
        <div className="fixed top-4 right-4 max-w-md z-50 bg-red-50 border-2 border-red-200 rounded-xl p-4 shadow-xl flex items-start gap-3">
          <div className="flex-shrink-0 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-red-900 mb-1">操作失败</h4>
            <p className="text-xs text-red-700">{error}</p>
          </div>
          <button onClick={clearError} className="flex-shrink-0 text-red-500 hover:text-red-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {synthesis.isCompleted && (
        <div className="fixed top-4 right-4 z-50 bg-white border-2 border-green-200 rounded-xl shadow-2xl p-4 min-w-[300px]">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-green-800">合成成功！</h4>
              <p className="mt-1 text-sm text-green-700">视频已保存到内容库</p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button size="sm" className="flex-1" onClick={handleDownload}>
              下载视频
            </Button>
            <a href="/content-library" className="flex-1">
              <Button size="sm" variant="secondary" className="w-full">
                查看内容库
              </Button>
            </a>
          </div>
        </div>
      )}

      <div className="flex h-[calc(100vh-8rem)] gap-5 flex-nowrap min-w-0 bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20">
        <div className="w-80 flex flex-col gap-4 overflow-hidden flex-shrink-0">
          <div className="max-h-[380px] flex-shrink-0 flex flex-col rounded-2xl border border-gray-200/60 bg-white/70 backdrop-blur-sm p-4 shadow-lg shadow-blue-100/50 overflow-hidden">
            <div className="flex-shrink-0 flex items-center gap-3 mb-3">
              <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h3 className="text-base font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                选择大纲
              </h3>
            </div>
            <OutlineListPanel
              stories={stories}
              loading={loadingStories}
              selectedOutlineId={selectedOutlineId}
              onOutlineSelect={handleOutlineSelect}
            />
          </div>

          <div className="flex-1 rounded-2xl border border-gray-200/60 bg-white/70 backdrop-blur-sm p-4 overflow-hidden flex flex-col shadow-lg shadow-blue-100/50">
            <SceneListPanel
              scenes={scenes}
              loading={loadingScenes}
              generating={scriptGenerating}
              selectedId={selectedStoryboardId}
              onSelect={handleSceneSelect}
              onGenerateAll={handleGenerateScripts}
              onViewScript={handleViewScript}
            />
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-4 overflow-hidden min-w-0">
          <div className="flex gap-4 overflow-hidden min-w-0" style={{ height: 'calc(65% - 1rem)' }}>
            <div className="w-1/2 rounded-2xl border border-gray-200/60 bg-white/70 backdrop-blur-sm p-3 shadow-xl shadow-blue-100/50 flex flex-col overflow-hidden min-w-0">
              <MediaLibrary selectedScene={selectedScene} onRefreshScenes={handleRefreshScenes} />
            </div>

            <div className="w-1/2 overflow-hidden min-w-0">
              <VideoPreviewPanel selectedScene={selectedScene} playback={playback} />
            </div>
          </div>

          <div className="overflow-hidden min-w-0" style={{ height: 'calc(35% - 1rem)' }}>
            <TimelinePanel
              playback={playback}
              selectedStoryboardId={selectedStoryboardId}
              onSceneClick={handleSceneSelect}
            />
          </div>
        </div>
      </div>

      {selectedScriptScene && (
        <ScriptResultModal
          isOpen={showScriptModal}
          onClose={handleCloseScriptModal}
          sceneTitle={`分镜 ${scenes.findIndex((s: any) => s.id === selectedScriptScene.id) + 1}: ${selectedScriptScene.title}`}
          scriptData={selectedScriptScene.scriptData}
        />
      )}
    </>
  );
}

