import sharp from 'sharp';
import { logger } from "@/shared/logger";

/**
 * 下载图片并转换为 Buffer
 * @param {string} url - 图片资源的远程 URL
 * @param {string} traceId - 追踪ID
 * @returns {Promise<Buffer>} 图片二进制数据
 */
export async function downloadImage(url: string, traceId: string = "unknown"): Promise<Buffer> {
  logger.info({
    event: "download_image_start",
    module: "lib/thumbnail",
    traceId,
    message: "开始下载图片",
    url
  });
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`下载图片失败: ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  
  logger.info({
    event: "download_image_success",
    module: "lib/thumbnail",
    traceId,
    message: "图片下载成功",
    size: buffer.byteLength
  });
  
  return Buffer.from(buffer);
}

/**
 * 生成缩略图 (Cover 模式)
 * @param {Buffer} imageBuffer - 原图 buffer
 * @param {number} size - 缩略图边长
 * @param {string} traceId - 追踪ID
 * @returns {Promise<Buffer>} 缩略图 buffer
 */
export async function generateThumbnail(imageBuffer: Buffer, size = 300, traceId: string = "unknown"): Promise<Buffer> {
  logger.info({
    event: "generate_thumbnail_start",
    module: "lib/thumbnail",
    traceId,
    message: `开始生成缩略图 (Cover), 尺寸: ${size}x${size}`
  });

  const thumbnail = await sharp(imageBuffer)
    .resize(size, size, {
      fit: 'cover',
      position: 'center',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 80 })
    .toBuffer();

  logger.info({
    event: "generate_thumbnail_success",
    module: "lib/thumbnail",
    traceId,
    message: "缩略图生成成功",
    size: thumbnail.byteLength
  });

  return thumbnail;
}

/**
 * 生成缩略图 (Inside 模式)
 * @param {Buffer} imageBuffer - 原图 buffer
 * @param {number} size - 缩略图最长边
 * @param {string} traceId - 追踪ID
 * @returns {Promise<Buffer>} 缩略图 buffer
 */
export async function generateThumbnailInside(imageBuffer: Buffer, size = 300, traceId: string = "unknown"): Promise<Buffer> {
  logger.info({
    event: "generate_thumbnail_inside_start",
    module: "lib/thumbnail",
    traceId,
    message: `开始生成缩略图 (Inside), 最长边: ${size}`
  });

  const thumbnail = await sharp(imageBuffer)
    .resize(size, size, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85 })
    .toBuffer();

  logger.info({
    event: "generate_thumbnail_inside_success",
    module: "lib/thumbnail",
    traceId,
    message: "缩略图生成成功 (Inside)",
    size: thumbnail.byteLength
  });
  
  return thumbnail;
}
