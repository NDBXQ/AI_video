import { generatedImageManager } from '@/storage/database/generatedImageManager';
import { storyboardTextManager } from '@/storage/database/storyboardTextManager';
import { createCozeStorage } from './image-generation/storage';
import { generateImageByCoze } from './image-generation/cozeClient';
import { downloadImage, generateThumbnail } from './image-generation/thumbnail';
import { normalizeStoryboardId, resolveStoryIdByStoryboardTextId } from './image-generation/story';

export interface GenerateImagePrompt {
  text: string;
  category: 'background' | 'role' | 'item';
  name: string;
}

export interface GenerateImageRequest {
  prompts: GenerateImagePrompt[];
  storyId?: string;
  storyboardId: string;
  forceRegenerate?: boolean;
}

export interface GenerateImageResult {
  images: Array<{ url: string; thumbnailUrl: string }>;
  skipped?: Array<{ index: number; name: string; url: string; thumbnailUrl: string; existingId: string }>;
  errors?: Array<{ prompt: string; error: string }>;
  total: number;
  successCount: number;
  skippedCount: number;
  message: string;
}

/**
 * 生成参考图（并保存到对象存储与数据库）
 * @param {GenerateImageRequest} request - 请求参数
 * @returns {Promise<GenerateImageResult>} 生成结果
 */
export async function generateReferenceImages(request: GenerateImageRequest): Promise<GenerateImageResult> {
  const { prompts, storyboardId, forceRegenerate = false } = request;
  const storage = createCozeStorage();

  const actualStoryboardId = normalizeStoryboardId(storyboardId);
  const storyId = await resolveStoryIdByStoryboardTextId(actualStoryboardId);

  const errors: Array<{ prompt: string; error: string }> = [];
  const skipped: Array<{ index: number; name: string; url: string; thumbnailUrl: string; existingId: string }> = [];

  console.log('[image-generation] 开始并发生成图片, 总数:', prompts.length);

  const results = await Promise.all(
    prompts.map(async (promptItem, index) => {
      const prompt = promptItem.text;
      const category = promptItem.category;

      try {
        console.log(
          `[image-generation] ========== 生成第 ${index + 1}/${prompts.length} 张图片 (category=${category}, name=${promptItem.name}) ==========`
        );

        const existingImage = await generatedImageManager.getGeneratedImageByName(
          storyId,
          promptItem.name,
          category
        );

        if (existingImage && !forceRegenerate) {
          const imageUrl = existingImage.url;
          const thumbnailUrl = existingImage.thumbnailUrl || existingImage.url;
          skipped.push({
            index,
            name: promptItem.name,
            url: imageUrl,
            thumbnailUrl,
            existingId: existingImage.id,
          });
          return { index, url: imageUrl, thumbnailUrl };
        }

        const apiImageUrl = await generateImageByCoze(prompt, category);
        const imageBuffer = await downloadImage(apiImageUrl, index);
        const thumbnailBuffer = await generateThumbnail(imageBuffer, 300);

        let originalFileKey: string;
        try {
          originalFileKey = await storage.uploadFile({
            fileContent: imageBuffer,
            fileName: `generated_${storyId}_${actualStoryboardId}_${index}_original.jpg`,
            contentType: 'image/jpeg',
          });
        } catch (uploadError) {
          console.error('[image-generation] uploadFile 失败，尝试 uploadFromUrl:', uploadError);
          originalFileKey = await storage.uploadFromUrl({
            url: apiImageUrl,
            timeout: 30000,
          });
        }

        const originalSignedUrl = await storage.generatePresignedUrl({
          key: originalFileKey,
          expireTime: 604800,
        });

        const thumbnailFileKey = await storage.uploadFile({
          fileContent: thumbnailBuffer,
          fileName: `generated_${storyId}_${actualStoryboardId}_${index}_thumbnail.jpg`,
          contentType: 'image/jpeg',
        });

        const thumbnailSignedUrl = await storage.generatePresignedUrl({
          key: thumbnailFileKey,
          expireTime: 604800,
        });

        if (existingImage && forceRegenerate) {
          await generatedImageManager.updateGeneratedImage(existingImage.id, {
            url: originalSignedUrl,
            storageKey: originalFileKey,
            thumbnailUrl: thumbnailSignedUrl,
            thumbnailStorageKey: thumbnailFileKey,
          });
        } else {
          await generatedImageManager.createGeneratedImage({
            storyId,
            name: promptItem.name || prompt.substring(0, 100),
            description: prompt,
            url: originalSignedUrl,
            storageKey: originalFileKey,
            thumbnailUrl: thumbnailSignedUrl,
            thumbnailStorageKey: thumbnailFileKey,
            category,
          });
        }

        return { index, url: originalSignedUrl, thumbnailUrl: thumbnailSignedUrl };
      } catch (error) {
        console.error(`[image-generation] 第 ${index + 1} 张图片生成异常:`, error);
        errors.push({ prompt, error: error instanceof Error ? error.message : '未知错误' });
        return { index, url: '', thumbnailUrl: '' };
      }
    })
  );

  const images = results
    .sort((a, b) => a.index - b.index)
    .map(({ url, thumbnailUrl }) => ({ url, thumbnailUrl }));

  const successCount = images.filter((r) => r.url && r.url.length > 0).length;
  const skippedCount = skipped.length;

  const hasSuccessImages = successCount > 0 || skippedCount > 0;
  if (hasSuccessImages) {
    try {
      await storyboardTextManager.updateStoryboardText(actualStoryboardId, { isCreatedReference: true });
    } catch (updateError) {
      console.error('[image-generation] 更新 is_created_reference 失败:', updateError);
    }
  }

  return {
    images,
    skipped: skippedCount > 0 ? skipped : undefined,
    errors: errors.length > 0 ? errors : undefined,
    total: prompts.length,
    successCount,
    skippedCount,
    message: `完成 ${successCount}/${prompts.length} 张图片生成（跳过 ${skippedCount} 张已存在的图片）`,
  };
}
