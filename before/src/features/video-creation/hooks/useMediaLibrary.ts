import { useEffect, useRef, useState } from 'react';
import { Scene, ReferenceImage, DescriptionWithCategory } from '../domain/types';

/**
 * 媒体库逻辑 Hook
 * 处理图片、视频、音频的加载、生成和合成逻辑
 * @param selectedScene 当前选中的分镜
 * @param onRefreshScenes 刷新分镜列表的回调
 */
export function useMediaLibrary(
  selectedScene: Scene | null,
  onRefreshScenes?: () => Promise<void>
) {
  // 图片合成状态
  const [imageComposed, setImageComposed] = useState(false);
  const [imageComposing, setImageComposing] = useState(false);
  const [composedImageUrl, setComposedImageUrl] = useState<string>();
  const [composedOriginalUrl, setComposedOriginalUrl] = useState<string>();
  const [composedImagePrompt, setComposedImagePrompt] = useState<string>();
  const [composedPromptLoading, setComposedPromptLoading] = useState(false);

  // 参考图生成状态
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [referenceImagesAvailable, setReferenceImagesAvailable] = useState(false);
  const [generatingImages, setGeneratingImages] = useState(false);
  const [loadingImages, setLoadingImages] = useState(false);
  const [regeneratingImage, setRegeneratingImage] = useState<ReferenceImage | null>(null);
  const [uploadingImage, setUploadingImage] = useState<ReferenceImage | null>(null);

  // 视频合成状态
  const [videoComposed, setVideoComposed] = useState(false);
  const [videoComposing, setVideoComposing] = useState(false);
  const [composedVideoUrl, setComposedVideoUrl] = useState<string>();
  const [videoMode, setVideoMode] = useState<'首帧' | '尾帧'>('首帧');
  const [loadingVideos, setLoadingVideos] = useState(false);
  const lastSceneIdRef = useRef<string | null>(null);
  const lastPromptStoryboardIdRef = useRef<string | null>(null);

  // 音频合成状态
  const [audioComposed, setAudioComposed] = useState(false);
  const [audioComposing, setAudioComposing] = useState(false);
  const [composedAudioUrl, setComposedAudioUrl] = useState<string>();

  /**
   * 规范化展开后的 ID（格式：${原始ID}-${index}）
   * @param {string} id - 原始 ID
   * @returns {string} 规范化后的 ID
   */
  const normalizeExpandedId = (id: string): string => {
    const lastHyphenIndex = id.lastIndexOf('-');
    if (lastHyphenIndex <= 0) return id;
    const suffix = id.substring(lastHyphenIndex + 1);
    if (!/^\d+$/.test(suffix)) return id;
    return id.substring(0, lastHyphenIndex);
  };

  useEffect(() => {
    const nextSceneId = selectedScene?.storyboardTextId || null;
    if (!nextSceneId || nextSceneId === lastSceneIdRef.current) return;
    lastSceneIdRef.current = nextSceneId;

    const type = selectedScene?.imagePromptType;
    if (type === '首帧' || type === '尾帧') {
      setVideoMode(type);
    } else {
      setVideoMode('首帧');
    }
  }, [selectedScene?.storyboardTextId, selectedScene?.imagePromptType]);

  useEffect(() => {
    const storyboardTextId = selectedScene?.storyboardTextId;
    if (!storyboardTextId) {
      setComposedPromptLoading(false);
      return;
    }

    if (lastPromptStoryboardIdRef.current !== storyboardTextId) {
      lastPromptStoryboardIdRef.current = storyboardTextId;
      setComposedImagePrompt(undefined);
    }

    let cancelled = false;

    const loadPromptOnce = async () => {
      try {
        const response = await fetch(
          `/api/video-creation/prompts?storyboardId=${encodeURIComponent(storyboardTextId)}`
        );
        const result = await response.json();
        if (!result?.success) return null;
        const imagePrompt =
          typeof result?.data?.imagePrompt === 'string' ? result.data.imagePrompt.trim() : '';
        return imagePrompt.length > 0 ? imagePrompt : null;
      } catch {
        return null;
      }
    };

    const poll = async () => {
      const existing = typeof composedImagePrompt === 'string' ? composedImagePrompt.trim() : '';
      if (existing.length > 0) {
        setComposedPromptLoading(false);
        return;
      }

      setComposedPromptLoading(true);

      for (let attempt = 0; attempt < 45; attempt += 1) {
        if (cancelled) return;
        const prompt = await loadPromptOnce();
        if (cancelled) return;
        if (prompt) {
          setComposedImagePrompt(prompt);
          setComposedPromptLoading(false);
          return;
        }
        await new Promise<void>((resolve) => window.setTimeout(resolve, 2000));
      }

      if (!cancelled) setComposedPromptLoading(false);
    };

    poll();

    return () => {
      cancelled = true;
    };
  }, [selectedScene?.storyboardTextId]);

  const handleSetVideoMode = async (mode: '首帧' | '尾帧') => {
    setVideoMode(mode);
    const storyboardId = selectedScene?.storyboardTextId;
    if (!storyboardId) return;
    try {
      await fetch('/api/video-creation/prompts/set-image-prompt-type', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyboardId, imagePromptType: mode }),
      });
    } catch (e) {
      console.error('[useMediaLibrary] 更新 image_prompt_type 失败:', e);
    }
  };

  /**
   * 从数据库加载已生成的图片
   */
  const loadGeneratedImages = async (scene: Scene, options?: { force?: boolean }) => {
    if (!scene?.storyId) return;

    const timestamp = Date.now();
    const descriptions = extractDescriptions(scene);
    const placeholders: ReferenceImage[] = Array.from(
      new Map(descriptions.map((d) => [`${d.category}:${d.name}`, d])).values()
    ).map((d) => ({
      id: `${d.category}:${d.name}`,
      name: d.name,
      url: '',
      category: d.category,
      storageKey: '',
      thumbnailUrl: '',
      thumbnailStorageKey: '',
      description: d.text,
    }));

    if (descriptions.length === 0) {
      setReferenceImages([]);
      setReferenceImagesAvailable(false);
      setImageComposed(false);
      setComposedImageUrl(undefined);
      setComposedOriginalUrl(undefined);
      return;
    }

    const names = Array.from(new Set(descriptions.map((d) => d.name))).filter((n) => n.length > 0);
    if (names.length === 0) {
      setReferenceImages(placeholders);
      setReferenceImagesAvailable(false);
      setImageComposed(false);
      setComposedImageUrl(undefined);
      setComposedOriginalUrl(undefined);
      return;
    }

    try {
      setLoadingImages(true);
      const apiUrl =
        names.length > 0
          ? `/api/video-creation/images?storyId=${encodeURIComponent(scene.storyId)}&names=${encodeURIComponent(names.join(','))}&t=${timestamp}`
          : `/api/video-creation/images?storyId=${encodeURIComponent(scene.storyId)}&t=${timestamp}`;

      console.log('[useMediaLibrary] 拉取参考图', {
        storyId: scene.storyId,
        storyboardTextId: scene.storyboardTextId,
        names,
        apiUrl,
      });

      const response = await fetch(apiUrl);
      const result = await response.json();

      if (result.success && result.data) {
        console.log('[useMediaLibrary] 参考图接口返回', {
          count: Array.isArray(result.data) ? result.data.length : 0,
        });
        const images: ReferenceImage[] = result.data.map((item: any) => ({
          id: item.id,
          name: item.name,
          url: item.url,
          category: item.category,
          storageKey: item.storageKey,
          thumbnailUrl: item.thumbnailUrl,
          thumbnailStorageKey: item.thumbnailStorageKey,
          description: item.description,
        }));

        const expectedComposedName =
          scene.storyboardTextId ? `合成图片_${normalizeExpandedId(scene.storyboardTextId)}` : undefined;
        const composedItem = expectedComposedName
          ? result.data.find((item: any) => item?.name === expectedComposedName)
          : result.data.find((item: any) => typeof item?.name === 'string' && item.name.startsWith('合成图片_'));

        if (composedItem) {
          console.log('[useMediaLibrary] 命中合成图', {
            name: composedItem?.name,
            url: composedItem?.url,
          });
          setImageComposed(true);
          setComposedImageUrl(composedItem.thumbnailUrl || composedItem.url);
          setComposedOriginalUrl(composedItem.url);
          if (typeof composedItem.description === 'string' && composedItem.description.trim().length > 0) {
            setComposedImagePrompt(composedItem.description);
          }
        } else {
          console.log('[useMediaLibrary] 未命中合成图');
          setImageComposed(false);
          setComposedImageUrl(undefined);
          setComposedOriginalUrl(undefined);
        }

        const referenceImagesFiltered = images.filter((img) => !img.name.startsWith('合成图片_'));
        setReferenceImagesAvailable(referenceImagesFiltered.length > 0);

        const merged = placeholders.map((placeholder) => {
          const actual = referenceImagesFiltered.find(
            (img) => img.name === placeholder.name && img.category === placeholder.category
          );
          return actual ?? placeholder;
        });

        const missing = placeholders
          .filter((p) => !referenceImagesFiltered.find((img) => img.name === p.name && img.category === p.category))
          .map((p) => ({ name: p.name, category: p.category }));
        console.log('[useMediaLibrary] 合并参考图', {
          expectedCount: placeholders.length,
          actualCount: referenceImagesFiltered.length,
          mergedCount: merged.length,
          missing,
        });

        setReferenceImages(merged.length > 0 ? merged : referenceImagesFiltered);
      }
    } catch (error) {
      console.error('[useMediaLibrary] 加载图片失败:', error);
      setReferenceImages(placeholders);
      setReferenceImagesAvailable(false);
    } finally {
      setLoadingImages(false);
    }
  };

  /**
   * 从数据库加载已生成的视频
   */
  const loadGeneratedVideos = async (storyboardId: string) => {
    if (!storyboardId) return;

    try {
      setLoadingVideos(true);
      const actualStoryboardId = normalizeExpandedId(storyboardId);

      const timestamp = Date.now();
      const response = await fetch(`/api/video-creation/videos?storyboardId=${actualStoryboardId}&t=${timestamp}`);
      const result = await response.json();

      if (result.success && result.data?.length > 0) {
        const latestVideo = result.data[result.data.length - 1];
        setVideoComposed(true);
        setComposedVideoUrl(latestVideo.playUrl || latestVideo.url);
        setVideoMode(latestVideo.mode as '首帧' | '尾帧' || '首帧');
      } else {
        setVideoComposed(false);
        setComposedVideoUrl(undefined);
      }
    } catch (error) {
      console.error('[useMediaLibrary] 加载视频失败:', error);
    } finally {
      setLoadingVideos(false);
    }
  };

  // 监听分镜变化
  useEffect(() => {
    if (selectedScene) {
      // 重置状态
      setImageComposed(false);
      setComposedImageUrl(undefined);
      setComposedOriginalUrl(undefined);
      setComposedImagePrompt(undefined);
      setVideoComposed(false);
      setComposedVideoUrl(undefined);
      setVideoMode('首帧');
      setAudioComposed(false);
      setComposedAudioUrl(undefined);

      if (selectedScene.storyboardTextId && selectedScene.storyId) {
        loadGeneratedImages(selectedScene);
      } else {
        setReferenceImages([]);
      }
      loadGeneratedVideos(selectedScene.id);
    } else {
      setReferenceImages([]);
      setReferenceImagesAvailable(false);
      setImageComposed(false);
      setComposedImageUrl(undefined);
      setComposedImagePrompt(undefined);
      setVideoComposed(false);
      setComposedVideoUrl(undefined);
      setAudioComposed(false);
      setComposedAudioUrl(undefined);
    }
  }, [selectedScene]);

  /**
   * 提取脚本中的描述
   */
  const extractDescriptions = (scene: Scene): DescriptionWithCategory[] => {
    if (!scene.generatedScript) return [];

    const parseJsonIfString = (input: any): any => {
      let value = input;
      for (let i = 0; i < 2 && typeof value === 'string'; i += 1) {
        try {
          value = JSON.parse(value);
        } catch {
          break;
        }
      }
      return value;
    };

    let script: any = parseJsonIfString(scene.generatedScript);
    if (script?.video_script) {
      script = {
        ...script,
        video_script: parseJsonIfString(script.video_script),
      };
    }
    const descriptions: DescriptionWithCategory[] = [];

    let videoContent: any = script;
    if (script.video_script?.video_content) {
      videoContent = script.video_script.video_content;
    } else if (script.video_content) {
      videoContent = script.video_content;
    } else {
      return [];
    }

    videoContent = parseJsonIfString(videoContent);

    if (videoContent.background?.description) {
      descriptions.push({
        text: videoContent.background.description,
        category: 'background',
        name: videoContent.background.background_name || videoContent.background.name || '背景',
      });
    }

    if (videoContent.roles?.length) {
      videoContent.roles.forEach((role: any) => {
        if (role.description) {
          descriptions.push({
            text: role.description,
            category: 'role',
            name: role.role_name || role.name || '角色',
          });
        }
      });
    }

    if (videoContent.items?.length) {
      videoContent.items.forEach((item: any) => {
        if (item.description) {
          descriptions.push({
            text: item.description,
            category: 'item',
            name: item.item_name || item.name || '物品',
          });
        }
      });
    }

    if (videoContent.other_items?.length) {
        videoContent.other_items.forEach((item: any) => {
          if (item.description) {
            descriptions.push({
              text: item.description,
              category: 'item',
              name: item.item_name || item.name || '物品',
            });
          }
        });
      }

    return descriptions;
  };

  /**
   * 生成参考图
   */
  const handleGenerateReferenceImages = async () => {
    if (!selectedScene || generatingImages) return;

    if (!selectedScene.generatedScript) {
      alert('请先为该分镜生成分镜脚本，然后再生成参考图');
      return;
    }

    const storyId = selectedScene.storyId;
    if (!storyId || !selectedScene.storyboardTextId) {
      alert('分镜数据异常：缺少必要参数');
      return;
    }

    setGeneratingImages(true);
    try {
      const descriptions = extractDescriptions(selectedScene);
      if (descriptions.length === 0) {
        alert('该分镜脚本中没有可用的描述字段');
        return;
      }

    const prompts = descriptions.map(d => ({
      text: d.text,
      category: d.category,
      name: d.name,
    }));

    console.log('[useMediaLibrary] 开始生成参考图请求:', {
      storyboardTextId: selectedScene.storyboardTextId,
      storyId,
      promptCount: prompts.length,
      prompts,
    });

    const response = await fetch('/api/video-creation/images/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompts: prompts,
        storyId: storyId,
        storyboardId: selectedScene.storyboardTextId,
      }),
    });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || '生成失败');

      if (result.success && result.data.images) {
        await loadGeneratedImages(selectedScene, { force: true });
        if (onRefreshScenes) {
          await onRefreshScenes();
        }
      } else {
        alert(result.message || '生成图片失败');
      }
    } catch (error) {
      console.error('[useMediaLibrary] 生成参考图异常:', error);
      alert(`生成参考图失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setGeneratingImages(false);
    }
  };

  /**
   * 重新生成单张图片
   */
  const handleRegenerateImage = async (image: ReferenceImage) => {
    if (!selectedScene || regeneratingImage) return;

    const storyId = selectedScene.storyId;
    if (!storyId || !selectedScene.storyboardTextId) return;

    const descriptions = extractDescriptions(selectedScene);
    const targetDesc = descriptions.find(d => d.name === image.name && d.category === image.category);

    if (!targetDesc) {
      alert('无法重新生成：未找到对应的描述字段');
      return;
    }

    setRegeneratingImage(image);
    try {
      const prompts = [{
        text: targetDesc.text,
        category: targetDesc.category,
        name: targetDesc.name,
      }];

      const response = await fetch('/api/video-creation/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompts: prompts,
          storyId: storyId,
          storyboardId: selectedScene.storyboardTextId,
          forceRegenerate: true,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || '生成失败');

      if (result.success && result.data.images?.length > 0) {
        setReferenceImages(prev => prev.map(img => 
          img.id === image.id ? {
            ...img,
            url: result.data.images[0].url,
            thumbnailUrl: result.data.images[0].thumbnailUrl || result.data.images[0].url
          } : img
        ));
        await loadGeneratedImages(selectedScene, { force: true });
      }
    } catch (error) {
      console.error('[useMediaLibrary] 重新生成异常:', error);
      alert(`重新生成失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setRegeneratingImage(null);
    }
  };

  const handleUploadReferenceImage = async (image: ReferenceImage, file: File) => {
    if (!selectedScene || !selectedScene.storyboardTextId || uploadingImage) return;
    setUploadingImage(image);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('storyboardId', selectedScene.storyboardTextId);
      formData.append('name', image.name);
      formData.append('category', image.category);
      if (typeof image.description === 'string' && image.description.trim().length > 0) {
        formData.append('description', image.description.trim());
      }

      const response = await fetch('/api/video-creation/images/upload', { method: 'POST', body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || '上传失败');

      if (result.success && result.data?.image) {
        await loadGeneratedImages(selectedScene, { force: true });
        if (onRefreshScenes) {
          await onRefreshScenes();
        }
      }
    } catch (error) {
      console.error('[useMediaLibrary] 上传参考图失败:', error);
      alert(`上传参考图失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setUploadingImage(null);
    }
  };

  /**
   * 合成图片
   */
  const handleComposeImage = async (): Promise<string> => {
    if (!selectedScene || imageComposing || !selectedScene.storyboardTextId) {
      throw new Error('无法合成图片');
    }

    setImageComposing(true);
    try {
      const response = await fetch('/api/video-creation/images/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyboardId: selectedScene.storyboardTextId }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || '合成失败');

      const imageUrl = result.data.image.url;
      setComposedOriginalUrl(imageUrl);
      setComposedImageUrl(result.data.image.thumbnailUrl || imageUrl);
      setImageComposed(true);
      setComposedImagePrompt(
        typeof result.data.image.prompt === 'string' && result.data.image.prompt.trim().length > 0
          ? result.data.image.prompt
          : undefined
      );
      return imageUrl;
    } catch (error) {
      console.error('合成图片失败:', error);
      alert('合成图片失败');
      throw error;
    } finally {
      setImageComposing(false);
    }
  };

  /**
   * 合成视频
   */
  const handleComposeVideo = async (options?: { forceRegenerate?: boolean }): Promise<string> => {
    if (!selectedScene || videoComposing || !selectedScene.storyboardTextId) {
      throw new Error('无法合成视频');
    }

    setVideoComposing(true);
    try {
      const response = await fetch('/api/video-creation/videos/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyboardId: selectedScene.storyboardTextId,
          mode: videoMode,
          forceRegenerate: options?.forceRegenerate === true,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || '生成失败');

      const videoUrl = result.data.video.url;
      setComposedVideoUrl(videoUrl);
      setVideoComposed(true);
      return videoUrl;
    } catch (error) {
      console.error('合成视频失败:', error);
      alert('合成视频失败');
      throw error;
    } finally {
      setVideoComposing(false);
    }
  };

  /**
   * 合成音频
   */
  const handleComposeAudio = async (): Promise<string> => {
    if (!selectedScene || audioComposing) throw new Error('无法合成音频');

    setAudioComposing(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000)); // 模拟API
      const audioUrl = ''; 
      setComposedAudioUrl(audioUrl);
      setAudioComposed(true);
      return audioUrl;
    } catch (error) {
      alert('合成音频失败');
      throw error;
    } finally {
      setAudioComposing(false);
    }
  };

  return {
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
    setVideoMode: handleSetVideoMode,
    
    // 音频状态
    audioComposed,
    audioComposing,
    composedAudioUrl,

    // 方法
    handleGenerateReferenceImages,
    handleRegenerateImage,
    handleUploadReferenceImage,
    handleComposeImage,
    handleComposeVideo,
    handleComposeAudio,
  };
}
