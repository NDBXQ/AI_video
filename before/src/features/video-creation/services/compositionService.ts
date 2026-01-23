import { generatedImageManager } from '@/storage/database/generatedImageManager';
import { promptsManager } from '@/storage/database/promptsManager';
import { storyManager } from '@/storage/database/storyManager';
import { createCozeStorage } from './image-generation/storage';
import { downloadImage, generateThumbnail } from './image-generation/thumbnail';
import { extractCozeImageUrl } from './image-generation/cozeClient';
import { normalizeStoryboardId, resolveStoryIdByStoryboardTextId } from './image-generation/story';

interface CozeComposeResponse {
  generated_image_url?: string;
  data?: string;
  url?: string;
  image?: string;
  [key: string]: any;
}

export interface ComposeImageResult {
  image: {
    id: string;
    name: string;
    url: string;
    thumbnailUrl: string;
    category: string;
    prompt: string;
  };
}

/**
 * 合成图片（基于参考图 + 图片提示词）
 * @param {string} storyboardId - 分镜文本 ID（storyboardTextId）
 * @returns {Promise<ComposeImageResult>} 合成结果
 */
export async function composeImage(storyboardId: string): Promise<ComposeImageResult> {
  const storage = createCozeStorage();
  const actualStoryboardId = normalizeStoryboardId(storyboardId);

  const storyId = await resolveStoryIdByStoryboardTextId(actualStoryboardId);
  const story = await storyManager.getStoryById(storyId);
  const aspectOptions = ['16:9', '4:3', '3:4', '9:16'] as const;
  const aspectRatio =
    typeof story?.aspectRatio === 'string' && (aspectOptions as readonly string[]).includes(story.aspectRatio)
      ? story.aspectRatio
      : '4:3';

  const promptRecord = await promptsManager.getPromptByStoryboardId(actualStoryboardId);
  if (!promptRecord) {
    throw new Error('未找到该分镜的提示词，请先生成提示词');
  }
  const imagePrompt = promptRecord.imagePrompt;
  if (!imagePrompt) {
    throw new Error('该分镜没有可用的图片提示词');
  }

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

  const extractNamesFromScriptJson = (scriptJson: any): string[] => {
    const script = parseJsonIfString(scriptJson);
    const videoContent = parseJsonIfString(script?.video_script?.video_content);
    const names: string[] = [];
    if (videoContent?.background) {
      const bgName = videoContent.background.background_name;
      if (typeof bgName === 'string' && bgName.trim().length > 0) names.push(bgName.trim());
    }
    if (Array.isArray(videoContent?.roles)) {
      for (const role of videoContent.roles) {
        const roleName = role?.role_name;
        if (typeof roleName === 'string' && roleName.trim().length > 0) names.push(roleName.trim());
      }
    }
    const items = Array.isArray(videoContent?.items) ? videoContent.items : [];
    const otherItems = Array.isArray(videoContent?.other_items) ? videoContent.other_items : [];
    for (const item of [...items, ...otherItems]) {
      const itemName = item?.item_name;
      if (typeof itemName === 'string' && itemName.trim().length > 0) names.push(itemName.trim());
    }
    console.log('names:', names);
    return Array.from(new Set(names));
  };
  const names = extractNamesFromScriptJson(promptRecord.scriptJson);
  if (names.length === 0) {
    throw new Error('无法从脚本中提取到参考图名称，请检查脚本格式');
  }
  const images = await generatedImageManager.getGeneratedImagesByStoryIdAndNames(storyId, names, true);
  if (images.length === 0) {
    throw new Error('该分镜没有参考图，请先生成参考图');
  }

  const apiUrl = process.env.COZE_IMAGE_COMPOSE_API_URL || "";
  const token = process.env.COZE_IMAGE_COMPOSE_API_TOKEN || "";
  if (!token) {
    throw new Error('缺少环境变量 COZE_IMAGE_COMPOSE_API_TOKEN');
  }

  const requestBody = {
    image_list: images.map((r) => ({
      image_name: r.name,
      image_url: r.url,
    })),
    prompt: imagePrompt,
    aspect_ratio: aspectRatio,
  };

  console.log('[image-compose] call coze', {
    storyboardId: actualStoryboardId,
    referenceImageCount: images.length,
    promptPreview: imagePrompt.slice(0, 80),
    aspectRatio,
  });

  const cozeResponse = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!cozeResponse.ok) {
    const errorText = await cozeResponse.text();
    throw new Error(`Coze API调用失败: ${cozeResponse.status} - ${errorText}`);
  }

  const cozeResult: CozeComposeResponse = await cozeResponse.json();
  const generatedImageUrl =
    (typeof cozeResult.generated_image_url === 'string' && cozeResult.generated_image_url) ||
    extractCozeImageUrl(cozeResult) ||
    null;
  if (!generatedImageUrl) {
    throw new Error('Coze API响应中没有找到图片URL');
  }

  const imageBuffer = await downloadImage(generatedImageUrl, 0);
  const thumbnailBuffer = await generateThumbnail(imageBuffer);

  const timestamp = Date.now();
  const imageStorageKey = await storage.uploadFile({
    fileContent: imageBuffer,
    fileName: `composed_${actualStoryboardId}_${timestamp}_original.jpg`,
    contentType: 'image/jpeg',
  });

  const imageUrl = await storage.generatePresignedUrl({
    key: imageStorageKey,
    expireTime: 604800,
  });

  const thumbnailStorageKey = await storage.uploadFile({
    fileContent: thumbnailBuffer,
    fileName: `composed_${actualStoryboardId}_${timestamp}_thumbnail.jpg`,
    contentType: 'image/jpeg',
  });

  const thumbnailUrl = await storage.generatePresignedUrl({
    key: thumbnailStorageKey,
    expireTime: 604800,
  });

  const composedName = `合成图片_${actualStoryboardId}`;
  const existingComposed = await generatedImageManager.getGeneratedImagesByStoryIdAndNameAll(
    storyId,
    composedName,
    'background'
  );

  const composedImage =
    existingComposed.length > 0
      ? await generatedImageManager.updateGeneratedImage(existingComposed[0].id, {
          name: composedName,
          description: imagePrompt,
          url: imageUrl,
          storageKey: imageStorageKey,
          thumbnailUrl,
          thumbnailStorageKey,
          category: 'background',
        })
      : await generatedImageManager.createGeneratedImage({
          storyId,
          name: composedName,
          description: imagePrompt,
          url: imageUrl,
          storageKey: imageStorageKey,
          thumbnailUrl,
          thumbnailStorageKey,
          category: 'background',
        });

  if (!composedImage) {
    throw new Error('合成图片写入数据库失败');
  }

  if (existingComposed.length > 1) {
    const idsToDelete = existingComposed.slice(1).map((img) => img.id);
    await generatedImageManager.deleteGeneratedImagesByIds(idsToDelete);
  }

  return {
    image: {
      id: composedImage.id,
      name: composedImage.name,
      url: imageUrl,
      thumbnailUrl,
      category: composedImage.category,
      prompt: imagePrompt,
    },
  };
}
