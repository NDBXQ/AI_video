/**
 * MediaLibrary - 媒体素材库容器组件
 * 整合图片、视频、音频三个素材库组件
 */

'use client';

import { useState } from 'react';
import { ImageLibrary } from './ImageLibrary';
import { VideoLibrary } from './VideoLibrary';
import { Scene } from '../domain/types';
import { useMediaLibrary } from '../hooks/useMediaLibrary';
import { ImagePreviewPortal } from './media-library/ImagePreviewPortal';

interface MediaLibraryProps {
  className?: string;
  selectedScene?: Scene | null;
  onRefreshScenes?: () => Promise<void>; // 刷新分镜列表（用于更新参考图生成状态）
}

export function MediaLibrary({ className = '', selectedScene, onRefreshScenes }: MediaLibraryProps) {
  // 当前选中的Tab
  const [activeTab, setActiveTab] = useState<'image' | 'video'>('image');

  // 图片预览状态
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    name: string;
  } | null>(null);

  // 使用自定义 Hook 处理业务逻辑
  const {
    // 图片状态
    imageComposed,
    imageComposing,
    composedImageUrl,
    composedOriginalUrl,
    composedImagePrompt,
    composedPromptLoading,
    referenceImages,
    referenceImagesAvailable,
    generatingImages,
    loadingImages,
    regeneratingImage,
    uploadingImage,
    
    // 视频状态
    videoComposed,
    videoComposing,
    composedVideoUrl,
    videoMode,
    setVideoMode,

    // 方法
    handleGenerateReferenceImages,
    handleRegenerateImage,
    handleUploadReferenceImage,
    handleComposeImage,
    handleComposeVideo,
  } = useMediaLibrary(selectedScene || null, onRefreshScenes);

  return (
    <>
      <div className={`flex flex-col gap-2 h-full overflow-hidden ${className}`}>
        {/* 标题 */}
        <div className="flex items-center gap-1.5 px-1 flex-shrink-0">
          <div className="w-4 h-4 bg-gradient-to-br from-orange-500 to-amber-600 rounded-md flex items-center justify-center">
            <span className="text-white text-[9px] font-bold">M</span>
          </div>
          <h3 className="text-xs font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
            媒体素材库
          </h3>
          {selectedScene && (
            <span className="px-1 py-0.5 bg-orange-100 text-orange-700 text-[8px] font-bold rounded-full ml-auto">
              {selectedScene.title}
            </span>
          )}
        </div>

        {!selectedScene ? (
          <div className="flex-1 rounded-lg border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center p-4">
            <div className="text-center">
              <p className="text-xs text-gray-500">请先选择一个分镜</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="flex-1 flex flex-col min-h-0">
              {/* Tab切换按钮 */}
              <div className="flex gap-1 mb-1.5 flex-shrink-0">
                <button
                  onClick={() => setActiveTab('image')}
                  className={`flex-1 px-2 py-1 rounded-md text-xs font-semibold flex items-center justify-center gap-0.5 transition-all ${
                    activeTab === 'image'
                      ? 'bg-violet-100 text-violet-700 border border-violet-300 shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
                  }`}
                >
                  <div className="w-2 h-2 bg-violet-500 rounded-sm" />
                  图片
                </button>
                <button
                  onClick={() => setActiveTab('video')}
                  className={`flex-1 px-2 py-1 rounded-md text-xs font-semibold flex items-center justify-center gap-0.5 transition-all ${
                    activeTab === 'video'
                      ? 'bg-blue-100 text-blue-700 border border-blue-300 shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
                  }`}
                >
                  <div className="w-2 h-2 bg-blue-500 rounded-sm" />
                  视频
                </button>
              </div>

              {/* 根据选中的Tab显示对应的内容 */}
              <div className="flex-1 min-h-0 overflow-hidden relative">
                {activeTab === 'image' && (
                  <ImageLibrary
                    scene={selectedScene || null}
                    onCompose={handleComposeImage}
                    composed={imageComposed}
                    composing={imageComposing}
                    composedImageUrl={composedImageUrl}
                    composedOriginalUrl={composedOriginalUrl}
                    composedPrompt={composedImagePrompt}
                    composedPromptLoading={composedPromptLoading}
                    referenceImages={referenceImages}
                    referenceImagesAvailable={referenceImagesAvailable}
                    onGenerateReferenceImages={handleGenerateReferenceImages}
                    onRegenerateImage={handleRegenerateImage}
                    regeneratingImage={regeneratingImage}
                    uploadingImage={uploadingImage}
                    onUploadReferenceImage={handleUploadReferenceImage}
                    generatingImages={generatingImages}
                    loadingImages={loadingImages}
                    onPreviewImage={(url, name) => setPreviewImage({ url, name })}
                  />
                )}
                {activeTab === 'video' && (
                  <VideoLibrary
                    key={selectedScene?.storyboardTextId || 'no-scene'}
                    scene={selectedScene || null}
                    onCompose={handleComposeVideo}
                    composed={videoComposed}
                    composing={videoComposing}
                    composedVideoUrl={composedVideoUrl}
                    videoMode={videoMode}
                    onVideoModeChange={setVideoMode}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

    {/* 全局图片预览弹窗（Portal渲染到body） */}
    <ImagePreviewPortal
      isOpen={!!previewImage}
      imageUrl={previewImage?.url}
      name={previewImage?.name}
      onClose={() => setPreviewImage(null)}
    />
  </>
  );
}
