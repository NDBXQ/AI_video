interface CozeImageResponse {
  data?: string;
  url?: string;
  image?: string;
  image_url?: string;
  image_type?: string;
  prompt?: string;
  [key: string]: any;
}

/**
 * 从 Coze 返回数据中提取图片 URL
 * @param {CozeImageResponse} data - Coze 返回的 JSON
 * @returns {string | null} 图片 URL
 */
export function extractCozeImageUrl(data: CozeImageResponse): string | null {
  if (data.data && typeof data.data === 'string') return data.data;
  if (data.url && typeof data.url === 'string') return data.url;
  if (data.image && typeof data.image === 'string') return data.image;
  if (data.image_url && typeof data.image_url === 'string') return data.image_url;
  if (data.data && typeof data.data === 'object') {
    const nested = extractCozeImageUrl(data.data as CozeImageResponse);
    if (nested) return nested;
  }

  const firstStringValue = Object.values(data).find(
    (val): val is string => typeof val === 'string' && (val.startsWith('http') || val.startsWith('data:'))
  );
  return firstStringValue || null;
}

/**
 * 调用 Coze 生成图片
 * @param {string} prompt - 提示词
 * @returns {Promise<string>} 图片 URL
 * @throws {Error} 调用失败或无法提取 URL 时抛出
 */
export async function generateImageByCoze(
  prompt: string,
  imageType: 'background' | 'role' | 'item' = 'item'
): Promise<string> {
  const apiUrl =
    process.env.COZE_REFERENCE_IMAGE_API_URL || 'https://bx3fr9ndvs.coze.site/run';
  const token = process.env.COZE_REFERENCE_IMAGE_API_TOKEN;
  if (!token) {
    throw new Error('缺少环境变量 COZE_REFERENCE_IMAGE_API_URL/COZE_REFERENCE_IMAGE_API_TOKEN');
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt: prompt.trim(), image_type: imageType }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Coze API 失败: ${response.status} ${errorText}`);
  }

  const data: CozeImageResponse = await response.json();
  const imageUrl = extractCozeImageUrl(data);
  if (!imageUrl) {
    throw new Error('无法提取图片URL');
  }
  return imageUrl;
}
