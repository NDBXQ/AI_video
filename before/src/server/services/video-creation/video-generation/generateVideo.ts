import { createCozeStorage } from '@/features/video-creation/services/image-generation/storage';
import { normalizeStoryboardId } from '@/features/video-creation/services/image-generation/story';
import { requestCozeVideoGenerate } from '@/server/integrations/coze/videoGenerate';
import { createCozeS3Storage } from '@/server/integrations/storage/cozeS3Storage';
import { generatedImageManager } from '@/storage/database/generatedImageManager';
import { generatedVideoManager } from '@/storage/database/generatedVideoManager';
import { promptsManager } from '@/storage/database/promptsManager';
import { storyManager } from '@/storage/database/storyManager';
import { storyOutlineManager } from '@/storage/database/storyOutlineManager';
import { storyboardScriptManager } from '@/storage/database/storyboardScriptManager';
import { storyboardTextManager } from '@/storage/database/storyboardTextManager';
import { extractShotDurationSeconds } from './utils';

export class ServiceError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface GenerateVideoParams {
  storyboardId: string;
  mode?: '首帧' | '尾帧';
  generateAudio?: boolean;
  watermark?: boolean;
  forceRegenerate?: boolean;
}

export interface GenerateVideoResult {
  id: string;
  name: string;
  url: string;
  mode: '首帧' | '尾帧';
}

const downloadVideo = async (url: string): Promise<Buffer> => {
  console.log('[generate-video] 开始下载视频...');
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`下载视频失败: ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  console.log('[generate-video] 视频下载成功，大小:', buffer.byteLength, 'bytes');
  return Buffer.from(buffer);
};

const extractPresignedExpiresAtSeconds = (signedUrl: string): number | null => {
  try {
    const urlObj = new URL(signedUrl);
    const signParam = urlObj.searchParams.get('sign') || '';
    const signPrefix = signParam.split('-')[0];
    const parsed = Number(signPrefix);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  } catch {}
  return null;
};

export async function generateVideo(params: GenerateVideoParams): Promise<GenerateVideoResult> {
  console.log('[generate-video] ========== 收到视频生成请求 ==========');
  const { storyboardId } = params;
  const forceRegenerate = params.forceRegenerate === true;
  let mode: '首帧' | '尾帧' | undefined = params.mode;
  const generateAudio = params.generateAudio ?? true;
  const watermark = params.watermark ?? false;

  console.log('[generate-video] 请求参数:');
  console.log('[generate-video] - storyboardId:', storyboardId);
  console.log('[generate-video] ======================================');

  let promptRecord = null as Awaited<ReturnType<typeof promptsManager.getPromptByStoryboardId>> | null;

  if (!mode) {
    try {
      promptRecord = await promptsManager.getPromptByStoryboardId(storyboardId);
      const dbMode = promptRecord?.imagePromptType;
      mode = dbMode === '首帧' || dbMode === '尾帧' ? dbMode : undefined;
    } catch (e) {
      console.error('[generate-video] 读取 prompts.image_prompt_type 失败:', e);
    }
  }

  if (!mode) {
    mode = '首帧';
  }

  console.log('[generate-video] - mode:', mode);

  if (!forceRegenerate) {
    const existingVideos = await generatedVideoManager.getGeneratedVideosByStoryboardId(storyboardId);
    const matchedExisting = (existingVideos || []).filter((v: any) => v.mode === mode).at(-1);
    if (matchedExisting) {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const signedUrl = typeof matchedExisting.url === 'string' ? matchedExisting.url : '';
      let playUrl = signedUrl;
      const signedUrlExpiresAt = signedUrl ? extractPresignedExpiresAtSeconds(signedUrl) : null;

      const shouldResign = !signedUrl || signedUrlExpiresAt === null || signedUrlExpiresAt <= nowSeconds + 300;
      if (shouldResign) {
        const storageForRead = createCozeStorage();
        try {
          playUrl = await storageForRead.generatePresignedUrl({ key: matchedExisting.storageKey });
        } catch {}
      }

      try {
        await storyboardTextManager.updateStoryboardText(normalizeStoryboardId(storyboardId), { isVideoGenerated: true });
      } catch (e) {
        console.error('[generate-video] 更新 storyboard_texts.is_video_generated 失败:', e);
      }

      return {
        id: matchedExisting.id,
        name: matchedExisting.name,
        url: playUrl,
        mode,
      };
    }
  }

  let storyId: string;
  try {
    console.log('[generate-video] 步骤1: 通过storyboardTextId查询storyId...');
    const storyboardText = await storyboardTextManager.getStoryboardTextById(storyboardId);
    if (!storyboardText) {
      throw new ServiceError(404, '未找到对应的分镜文本');
    }

    const outline = await storyOutlineManager.getOutlineById(storyboardText.outlineId);
    if (!outline) {
      throw new ServiceError(404, '未找到对应的大纲');
    }

    storyId = outline.storyId;
    console.log('[generate-video] ✅ 查询到的storyId:', storyId);
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    console.error('[generate-video] 查询storyId失败:', error);
    throw new ServiceError(500, '查询storyId失败');
  }

  let ratio: string = '16:9';
  try {
    const story = await storyManager.getStoryById(storyId);
    const aspectOptions = ['16:9', '4:3', '3:4', '9:16'] as const;
    ratio =
      typeof story?.aspectRatio === 'string' && (aspectOptions as readonly string[]).includes(story.aspectRatio)
        ? story.aspectRatio
        : '16:9';
  } catch (e) {
    console.error('[generate-video] 读取 stories.aspect_ratio 失败:', e);
  }

  let videoPrompt: string | undefined;
  try {
    console.log('[generate-video] 步骤2: 获取该分镜的提示词...');

    if (!promptRecord) {
      promptRecord = await promptsManager.getPromptByStoryboardId(storyboardId);
    }

    if (!promptRecord) {
      throw new ServiceError(404, '未找到该分镜的提示词，请先生成提示词');
    }

    videoPrompt = promptRecord.videoPrompt ?? undefined;
    if (!videoPrompt) {
      throw new ServiceError(400, '该分镜没有可用的视频提示词');
    }

    console.log('[generate-video] ✅ 获取到视频提示词:', videoPrompt.substring(0, 100) + '...');
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    console.error('[generate-video] 获取提示词失败:', error);
    throw new ServiceError(500, '获取提示词失败');
  }

  let duration: number = 10;
  try {
    const scripts = await storyboardScriptManager.getStoryboardScriptsByTextId(normalizeStoryboardId(storyboardId));
    const primaryScript = scripts.find((s) => s?.scriptContent != null) ?? null;
    const v = primaryScript ? extractShotDurationSeconds(primaryScript.scriptContent) : undefined;
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
      duration = v;
    } else if (promptRecord?.scriptJson) {
      const fallback = extractShotDurationSeconds(promptRecord.scriptJson);
      if (typeof fallback === 'number' && Number.isFinite(fallback) && fallback > 0) {
        duration = fallback;
      }
    }
  } catch (e) {
    console.error('[generate-video] 读取脚本时长失败:', e);
  }

  let composedImageUrl: string | undefined;
  try {
    console.log('[generate-video] 步骤3: 获取该分镜的合成图片...');
    const composedName = `合成图片_${normalizeStoryboardId(storyboardId)}`;
    const images = await generatedImageManager.getGeneratedImagesByStoryIdAndNames(storyId, [composedName], false);
    const composedImages = images.filter((img) => img.name === composedName && img.category === 'background');

    if (composedImages.length === 0) {
      throw new ServiceError(400, '该分镜没有合成图片，请先合成图片');
    }

    composedImageUrl = composedImages[composedImages.length - 1].url;
    console.log('[generate-video] ✅ 获取到合成图片URL:', composedImageUrl.substring(0, 80) + '...');
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    console.error('[generate-video] 获取合成图片失败:', error);
    throw new ServiceError(500, '获取合成图片失败');
  }

  console.log('[generate-video] 步骤4: 调用Coze视频生成API...');
  console.log(
    '[generate-video] 请求体:',
    JSON.stringify(
      {
        prompt: videoPrompt.substring(0, 100) + '...',
        mode: mode,
        generate_audio: generateAudio,
        ratio: ratio,
        duration: duration,
        watermark,
        image_url: composedImageUrl.substring(0, 80) + '...',
      },
      null,
      2
    )
  );

  let generatedVideoUrl: string;
  try {
    generatedVideoUrl = await requestCozeVideoGenerate({
      prompt: videoPrompt,
      mode,
      generateAudio,
      ratio,
      duration,
      watermark,
      imageUrl: composedImageUrl,
    });
  } catch (e) {
    console.error('[generate-video] Coze API错误:', e);
    const message = e instanceof Error ? e.message : 'Coze API调用失败';
    throw new ServiceError(500, message);
  }

  console.log('[generate-video] ✅ 生成的视频URL:', generatedVideoUrl);

  console.log('[generate-video] 步骤5: 下载生成的视频...');
  const videoBuffer = await downloadVideo(generatedVideoUrl);

  console.log('[generate-video] 步骤6: 上传视频到对象存储...');
  const storage = createCozeS3Storage();
  const timestamp = Date.now();

  console.log('[generate-video] 上传原视频...');
  const videoStorageKey = await storage.uploadFile({
    fileContent: videoBuffer,
    fileName: `generated_video_${storyboardId}_${timestamp}.mp4`,
    contentType: 'video/mp4',
  });
  console.log('[generate-video] 原视频上传成功, key:', videoStorageKey);

  const videoUrl = await storage.generatePresignedUrl({
    key: videoStorageKey,
    expireTime: 604800,
  });
  console.log('[generate-video] 原视频签名URL生成成功:', videoUrl);

  console.log('[generate-video] 步骤7: 保存到数据库...');
  const generatedVideo = await generatedVideoManager.createGeneratedVideo({
    storyId,
    storyboardId,
    name: `生成视频_${storyboardId}`,
    description: videoPrompt,
    url: videoUrl,
    storageKey: videoStorageKey,
    mode: mode,
  });

  console.log('[generate-video] ✅ 保存到数据库成功, id:', generatedVideo.id);

  try {
    await storyboardTextManager.updateStoryboardText(normalizeStoryboardId(storyboardId), { isVideoGenerated: true });
  } catch (e) {
    console.error('[generate-video] 更新 storyboard_texts.is_video_generated 失败:', e);
  }

  return {
    id: generatedVideo.id,
    name: generatedVideo.name,
    url: videoUrl,
    mode,
  };
}
