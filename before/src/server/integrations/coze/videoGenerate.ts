export interface RequestCozeVideoGenerateParams {
  prompt: string;
  mode: '首帧' | '尾帧';
  generateAudio: boolean;
  ratio: string;
  duration: number;
  watermark: boolean;
  imageUrl: string;
}

interface CozeVideoResponse {
  data?: string;
  url?: string;
  video_url?: string;
  generated_video_url?: string;
  [key: string]: any;
}

export async function requestCozeVideoGenerate(params: RequestCozeVideoGenerateParams): Promise<string> {
  const COZE_API_URL = process.env.COZE_VIDEO_GENERATE_API_URL || 'https://3f47zmnfcb.coze.site/run';
  const COZE_TOKEN = process.env.COZE_VIDEO_GENERATE_API_TOKEN;
  if (!COZE_TOKEN) {
    throw new Error('服务器配置错误：缺少 COZE_VIDEO_GENERATE_API_TOKEN');
  }

  const requestBody = {
    prompt: params.prompt,
    mode: params.mode,
    generate_audio: params.generateAudio,
    ratio: params.ratio,
    duration: params.duration,
    watermark: params.watermark,
    image: {
      url: params.imageUrl,
      file_type: 'image',
    },
  };

  const controller = new AbortController();
  const timeoutMs = 5 * 60 * 1000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let cozeResponse: Response;
  try {
    cozeResponse = await fetch(COZE_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${COZE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Coze API调用超时: ${timeoutMs / 1000}s`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!cozeResponse.ok) {
    const errorText = await cozeResponse.text();
    throw new Error(`Coze API调用失败: ${cozeResponse.status} - ${errorText}`);
  }

  const cozeResult: CozeVideoResponse = await cozeResponse.json();
  const generatedVideoUrl = cozeResult.generated_video_url || cozeResult.video_url || cozeResult.data || cozeResult.url;
  if (!generatedVideoUrl) {
    throw new Error('Coze API响应中没有找到视频URL');
  }

  return generatedVideoUrl;
}
