/**
 * ImageLibrary - 图片素材库组件
 * 包含参考图展示和合成图展示
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Image as ImageIcon,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  Zap,
  X,
  Upload,
} from 'lucide-react';
import { Scene, ReferenceImage } from '../domain/types';

interface ImageLibraryProps {
  scene: Scene | null;
  onCompose?: () => Promise<string>;
  composed?: boolean;
  composing?: boolean;
  composedImageUrl?: string;
  composedOriginalUrl?: string; // 原图URL，用于预览
  composedPrompt?: string;
  composedPromptLoading?: boolean;
  referenceImages?: ReferenceImage[];
  referenceImagesAvailable?: boolean;
  onGenerateReferenceImages?: () => void;
  onRegenerateImage?: (image: ReferenceImage) => void;
  regeneratingImage?: ReferenceImage | null;
  uploadingImage?: ReferenceImage | null;
  onUploadReferenceImage?: (image: ReferenceImage, file: File) => Promise<void> | void;
  generatingImages?: boolean;
  loadingImages?: boolean;
  onPreviewImage?: (url: string, name: string) => void;
}

// 参考图卡片组件 - 优化版（更紧凑）
function ReferenceImageCard({
  image,
  onClick,
  onRegenerate,
  onUpload,
  regenerating,
  uploading,
}: {
  image: ReferenceImage;
  onClick: () => void;
  onRegenerate?: () => void;
  onUpload?: (file: File) => void;
  regenerating?: boolean;
  uploading?: boolean;
}) {
  const previewUrl = image.thumbnailUrl || image.url;
  const canPreview = typeof previewUrl === 'string' && previewUrl.trim().length > 0;
  const disabled = !!regenerating || !!uploading;
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="group flex flex-col gap-1">
      <div
        className="relative aspect-video rounded-lg overflow-hidden border border-gray-100 bg-gray-50 cursor-pointer shadow-xs hover:shadow-sm transition-all group-hover:border-violet-200"
        onClick={() => {
          if (canPreview) {
            onClick();
            return;
          }
          inputRef.current?.click();
        }}
      >
        {canPreview ? (
          <img
            src={previewUrl}
            alt={image.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-300 bg-gray-50/60">
            <ImageIcon className="w-6 h-6" />
            <span className="text-[10px] font-semibold text-gray-400">待生成/可上传</span>
          </div>
        )}
        
        {/* 悬停操作层 - 更紧凑 */}
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-center gap-1.5">
          {canPreview && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}
              className="p-1 bg-white/20 hover:bg-white/30 backdrop-blur-xs rounded-full text-white transition-colors"
              title="查看大图"
            >
              <ImageIcon className="w-3 h-3" />
            </button>
          )}
          
          {onRegenerate && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRegenerate();
              }}
              disabled={disabled}
              className={`p-1 bg-white/20 hover:bg-white/30 backdrop-blur-xs rounded-full text-white transition-colors ${
                disabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title={canPreview ? '重新生成' : '生成'}
            >
              <RefreshCw className={`w-3 h-3 ${regenerating ? 'animate-spin' : ''}`} />
            </button>
          )}

          {onUpload && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                inputRef.current?.click();
              }}
              disabled={disabled}
              className={`p-1 bg-white/20 hover:bg-white/30 backdrop-blur-xs rounded-full text-white transition-colors ${
                disabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title="上传图片"
            >
              <Upload className="w-3 h-3" />
            </button>
          )}
        </div>

        {onUpload && (
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              onUpload(file);
            }}
          />
        )}
      </div>
      
      {/* 图片名称 - 更紧凑 */}
      <div className="px-0.5">
        <p className="text-[9px] font-medium text-gray-600 truncate text-center group-hover:text-violet-600 transition-colors">
          {image.name}
        </p>
      </div>
    </div>
  );
}

// 合成图区域组件 - 优化版 (更紧凑的横向布局)
function ComposedImageArea({
  imageUrl,
  composing,
  onCompose,
  composed,
  prompt,
  promptLoading,
  composeAvailable,
  onPreviewImage,
  originalUrl,
}: {
  imageUrl?: string;
  composing?: boolean;
  onCompose?: () => Promise<void>;
  composed?: boolean;
  prompt?: string;
  promptLoading?: boolean;
  composeAvailable?: boolean;
  onPreviewImage?: (url: string, name: string) => void;
  originalUrl?: string;
}) {
  const [promptOpen, setPromptOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const promptText = typeof prompt === 'string' ? prompt.trim() : '';
  const promptAvailable = promptText.length > 0;
  const loading = !!promptLoading;
  const canCompose = !!composeAvailable;

  useEffect(() => {
    if (!promptOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPromptOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [promptOpen]);

  return (
    <div className="bg-gradient-to-br from-violet-50/50 to-purple-50/50 rounded-lg border border-violet-100 p-1.5 flex items-center gap-1.5">
      {/* 左侧：预览/占位区 */}
      <div 
        className="relative w-28 aspect-video flex-shrink-0 rounded-lg overflow-hidden bg-white border border-violet-100 shadow-xs group cursor-pointer"
        onClick={() => {
          if (composed && originalUrl && onPreviewImage) {
            onPreviewImage(originalUrl, '合成图片');
          }
        }}
      >
        {composed && imageUrl ? (
          <>
            <img
              src={imageUrl}
              alt="合成图片"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
            {/* 悬停查看提示 */}
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-center">
              <ImageIcon className="w-4 h-4 text-white/90" />
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-violet-200 bg-gray-50/50">
            {composing ? (
              <RefreshCw className="w-5 h-5 animate-spin text-violet-400" />
            ) : (
              <Sparkles className="w-5 h-5" />
            )}
          </div>
        )}
      </div>

      {/* 右侧：信息与操作区 */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-bold text-gray-800">最终画面合成</h4>
            <p className="text-[10px] text-gray-500 mt-0.5">
              {composed ? '已根据参考图生成高清背景' : 'AI 智能融合角色与场景'}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {composed && (
              <button
                type="button"
                onClick={() => {
                  if (!onCompose || composing) return;
                  onCompose();
                }}
                disabled={!onCompose || composing}
                className={`p-1 rounded-md border transition-colors ${
                  !onCompose || composing
                    ? 'bg-white/40 border-violet-100 text-violet-300 cursor-not-allowed'
                    : 'bg-white/70 hover:bg-white border-violet-200 text-violet-700'
                }`}
                title="重新生成合成图"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${composing ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (!promptAvailable) return;
                setPromptOpen(true);
              }}
              disabled={!promptAvailable}
              className={`p-1 rounded-md border transition-colors ${
                promptAvailable
                  ? 'bg-white/70 hover:bg-white border-violet-200 text-violet-700'
                  : 'bg-white/40 border-violet-100 text-violet-300 cursor-not-allowed'
              }`}
              title={promptAvailable ? '查看提示词' : loading ? '提示词生成中...' : '暂无可查看的提示词'}
            >
              <Zap className="w-3.5 h-3.5" />
            </button>

            {composed && (
              <span className="flex items-center gap-0.5 px-1 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-semibold rounded-full">
                <CheckCircle2 className="w-2.5 h-2.5" />
                完成
              </span>
            )}
          </div>
        </div>

        {!composed && (
          <button
            onClick={() => {
              if (!canCompose) return;
              onCompose?.();
            }}
            disabled={composing || !canCompose}
            className={`w-full mt-0.5 flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              composing || !canCompose
                ? 'bg-violet-100 text-violet-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-xs hover:shadow-sm hover:-translate-y-0.5'
            }`}
            title={canCompose ? '合成图片' : '暂无参考图，无法合成'}
          >
            {composing ? '合成中...' : '合成图片'}
          </button>
        )}
      </div>

      {promptOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setPromptOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white border border-gray-200 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900">合成提示词</div>
                <div className="text-[11px] text-gray-500 mt-0.5 truncate">用于生成当前“最终画面合成”的提示词</div>
              </div>
              <button
                type="button"
                onClick={() => setPromptOpen(false)}
                className="p-1 rounded-md hover:bg-gray-100 text-gray-600"
                title="关闭"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-4 py-3">
              <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 max-h-[45vh] overflow-auto">
                <pre className="text-xs leading-relaxed text-gray-800 whitespace-pre-wrap break-words">
                  {promptText}
                </pre>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-100">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(promptText);
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1200);
                  } catch {
                    alert('复制失败，请手动复制');
                  }
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white transition-colors"
              >
                {copied ? '已复制' : '复制提示词'}
              </button>
              <button
                type="button"
                onClick={() => setPromptOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ImageLibrary({
  scene,
  onCompose,
  composed = false,
  composing = false,
  composedImageUrl,
  composedOriginalUrl,
  composedPrompt,
  composedPromptLoading,
  referenceImages = [],
  referenceImagesAvailable,
  onGenerateReferenceImages,
  onRegenerateImage,
  regeneratingImage,
  uploadingImage,
  onUploadReferenceImage,
  generatingImages = false,
  loadingImages = false,
  onPreviewImage,
}: ImageLibraryProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'character' | 'background' | 'item'>('all');

  const filteredImages = referenceImages.filter(img => {
    if (activeTab === 'all') return true;
    if (activeTab === 'character') return img.category === 'role';
    return img.category === activeTab;
  });

  const handleCompose = async () => {
    if (onCompose) {
      await onCompose();
    }
  };
  const canCompose = !!scene?.generatedScript && !!referenceImagesAvailable;

  const handleGenerateImages = () => {
    console.log('[ImageLibrary] 点击生成参考图按钮');
    console.log('[ImageLibrary] scene:', scene);
    console.log('[ImageLibrary] scene.generatedScript:', scene?.generatedScript);
    console.log('[ImageLibrary] referenceImages.length:', referenceImages.length);
    if (onGenerateReferenceImages) {
      console.log('[ImageLibrary] 调用 onGenerateReferenceImages');
      onGenerateReferenceImages();
    } else {
      console.warn('[ImageLibrary] onGenerateReferenceImages 未定义');
    }
  };

  const handleRegenerateImage = (image: ReferenceImage) => {
    console.log('[ImageLibrary] 点击重新生成图片按钮');
    console.log('[ImageLibrary] 重新生成的图片:', image.name, image.id);
    if (onRegenerateImage) {
      onRegenerateImage(image);
    } else {
      console.warn('[ImageLibrary] onRegenerateImage 未定义');
    }
  };

  const handlePreviewImage = (url: string, name: string) => {
    if (onPreviewImage) {
      onPreviewImage(url, name);
    }
  };

  // 添加调试日志
  console.log('[ImageLibrary] ========== 渲染组件 ==========');
  console.log('[ImageLibrary] scene:', scene?.id, scene?.title);
  console.log('[ImageLibrary] scene.generatedScript:', !!scene?.generatedScript);
  console.log('[ImageLibrary] referenceImages.length:', referenceImages.length);
  console.log('[ImageLibrary] referenceImages详情:', JSON.stringify(referenceImages, null, 2));
  console.log('[ImageLibrary] generatingImages:', generatingImages);
  console.log('[ImageLibrary] loadingImages:', loadingImages);
  console.log('[ImageLibrary] =================================');

  return (
    <div className="flex flex-col h-full overflow-hidden">
        {/* 标题 - 移除，由外层统一控制 */}

        {!scene ? (
          <div className="flex-1 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center p-8">
            <div className="text-center">
              <ImageIcon className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-500">请先选择一个分镜</p>
            </div>
          </div>
        ) : (
          <>
            {/* 参考图区域 */}
            <div className="flex-1 flex flex-col min-h-0">
              {/* 头部操作栏：Tabs + 生成按钮 */}
              <div className="flex items-center justify-between mb-1.5 flex-shrink-0">
                <div className="flex p-0.5 bg-gray-100/80 rounded-md border border-gray-200/50">
                  {[
                    { id: 'all', label: '全部', color: 'text-gray-700', bg: 'bg-white' },
                    { id: 'character', label: '角色', color: 'text-pink-700', bg: 'bg-pink-50' },
                    { id: 'background', label: '背景', color: 'text-blue-700', bg: 'bg-blue-50' },
                    { id: 'item', label: '物品', color: 'text-amber-700', bg: 'bg-amber-50' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-sm transition-all duration-150 ${
                        activeTab === tab.id
                          ? `${tab.bg} ${tab.color} shadow-xxs`
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleGenerateImages}
                  disabled={generatingImages || loadingImages || !scene.generatedScript}
                  className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold transition-all ${
                    generatingImages || loadingImages || !scene.generatedScript
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                      : 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-xxs hover:shadow-xs border border-violet-400/30'
                  }`}
                >
                  {generatingImages ? (
                    <RefreshCw className="w-2 h-2 animate-spin" />
                  ) : loadingImages ? (
                    <RefreshCw className="w-2 h-2 animate-spin" />
                  ) : (
                    <Zap className="w-2 h-2" />
                  )}
                  {generatingImages ? '生成中' : loadingImages ? '加载中' : '参考图'}
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto pr-0.5">
                {referenceImages.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 flex items-center justify-center h-28">
                    <div className="text-center">
                      <ImageIcon className="w-5 h-5 text-gray-300 mx-auto mb-1.5" />
                      <p className="text-[10px] text-gray-400">
                        {scene.generatedScript ? '暂无参考图，请点击生成' : '请先生成分镜脚本'}
                      </p>
                    </div>
                  </div>
                ) : filteredImages.length === 0 ? (
                   <div className="flex flex-col items-center justify-center h-28 text-gray-400">
                     <p className="text-[10px]">该分类下暂无图片</p>
                   </div>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5 pb-1">
                    {filteredImages.map((image) => (
                      <ReferenceImageCard
                        key={image.id}
                        image={image}
                        onClick={() => handlePreviewImage(image.url, image.name)}
                        onRegenerate={() => handleRegenerateImage(image)}
                        regenerating={regeneratingImage?.id === image.id}
                        uploading={uploadingImage?.id === image.id}
                        onUpload={
                          onUploadReferenceImage
                            ? (file) => {
                                onUploadReferenceImage(image, file);
                              }
                            : undefined
                        }
                      />
                    ))}
                  </div>
                )}

                <div className="border-t border-gray-300 pt-1 mt-2">
                  <ComposedImageArea
                    imageUrl={composedImageUrl}
                    composing={composing}
                    onCompose={handleCompose}
                    composed={composed}
                    prompt={composedPrompt}
                    promptLoading={composedPromptLoading}
                    composeAvailable={canCompose}
                    onPreviewImage={handlePreviewImage}
                    originalUrl={composedOriginalUrl}
                  />
                </div>
              </div>
            </div>
          </>
        )}
    </div>
  );
}
