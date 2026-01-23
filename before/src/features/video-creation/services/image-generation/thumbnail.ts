import sharp from 'sharp';

/**
 * 下载图片并转换为 Buffer
 * @param {string} url - 图片资源的远程 URL
 * @param {number} index - 当前下载任务的索引（用于日志）
 * @returns {Promise<Buffer>} 图片二进制数据
 */
export async function downloadImage(url: string, index: number): Promise<Buffer> {
  console.log(`[image-generation] 开始下载第 ${index + 1} 张图片...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`下载图片失败: ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  console.log(`[image-generation] 第 ${index + 1} 张图片下载成功，大小: ${buffer.byteLength} bytes`);
  return Buffer.from(buffer);
}

/**
 * 生成缩略图
 * @param {Buffer} imageBuffer - 原图 buffer
 * @param {number} size - 缩略图边长
 * @returns {Promise<Buffer>} 缩略图 buffer
 */
export async function generateThumbnail(imageBuffer: Buffer, size = 300): Promise<Buffer> {
  console.log(`[image-generation] 开始生成缩略图，尺寸: ${size}x${size}`);
  const thumbnail = await sharp(imageBuffer)
    .resize(size, size, {
      fit: 'cover',
      position: 'center',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 80 })
    .toBuffer();
  console.log(`[image-generation] 缩略图生成成功，大小: ${thumbnail.byteLength} bytes`);
  return thumbnail;
}

export async function generateThumbnailInside(imageBuffer: Buffer, size = 300): Promise<Buffer> {
  console.log(`[image-generation] 开始生成缩略图(不裁剪)，最长边: ${size}`);
  const thumbnail = await sharp(imageBuffer)
    .resize(size, size, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85 })
    .toBuffer();
  console.log(`[image-generation] 缩略图生成成功(不裁剪)，大小: ${thumbnail.byteLength} bytes`);
  return thumbnail;
}
