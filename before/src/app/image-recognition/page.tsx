'use client';

import { useState } from 'react';
import Image from 'next/image';

export default function ImageRecognitionPage() {
  const [imageUrl, setImageUrl] = useState('');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [inputMethod, setInputMethod] = useState<'url' | 'upload'>('url');

  const handleUrlSubmit = async () => {
    if (!imageUrl.trim()) {
      setError('请输入图片 URL');
      return;
    }

    await recognizeImage({
      imageUrl: imageUrl.trim(),
      prompt: customPrompt.trim() || undefined,
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 限制文件大小为 10MB
    if (file.size > 10 * 1024 * 1024) {
      setError('图片大小不能超过 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setUploadedImage(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadSubmit = async () => {
    if (!uploadedImage) {
      setError('请先上传图片');
      return;
    }

    await recognizeImage({
      imageData: uploadedImage,
      prompt: customPrompt.trim() || undefined,
    });
  };

  const recognizeImage = async (params: {
    imageUrl?: string;
    imageData?: string;
    prompt?: string;
  }) => {
    setIsLoading(true);
    setError('');
    setResult('');

    try {
      const response = await fetch('/api/image-recognition', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '识别失败');
      }

      setResult(data.result || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : '识别失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-2 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          AI 图片识别
        </h1>
        <p className="text-center text-gray-600 mb-8">
          使用豆包视觉模型智能识别图片内容
        </p>

        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          {/* 输入方式切换 */}
          <div className="flex gap-4 mb-6">
            <button
              onClick={() => setInputMethod('url')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                inputMethod === 'url'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              图片 URL
            </button>
            <button
              onClick={() => setInputMethod('upload')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                inputMethod === 'upload'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              上传图片
            </button>
          </div>

          {/* URL 输入 */}
          {inputMethod === 'url' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                图片 URL
              </label>
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          )}

          {/* 图片上传 */}
          {inputMethod === 'upload' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                上传图片
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                支持 JPG、PNG、GIF、WebP 格式，最大 10MB
              </p>
            </div>
          )}

          {/* 自定义提示词 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              自定义提示词（可选）
            </label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="例如：请识别图片中的文字内容"
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
          </div>

          {/* 提交按钮 */}
          <button
            onClick={inputMethod === 'url' ? handleUrlSubmit : handleUploadSubmit}
            disabled={isLoading || (!imageUrl.trim() && !uploadedImage)}
            className="w-full py-3 px-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isLoading ? '识别中...' : '开始识别'}
          </button>
        </div>

        {/* 图片预览 */}
        {(imageUrl || uploadedImage) && (
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">图片预览</h2>
            <div className="relative w-full aspect-video bg-gray-100 rounded-lg overflow-hidden">
              <Image
                src={imageUrl || uploadedImage!}
                alt="Preview"
                fill
                className="object-contain"
                unoptimized
              />
            </div>
          </div>
        )}

        {/* 错误信息 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* 识别结果 */}
        {result && (
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">识别结果</h2>
            <div className="prose max-w-none">
              <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                {result}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
