'use client';

import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ImagePreviewPortalProps {
  isOpen: boolean;
  imageUrl?: string;
  name?: string;
  onClose: () => void;
}

export function ImagePreviewPortal({
  isOpen,
  imageUrl,
  name,
  onClose,
}: ImagePreviewPortalProps) {
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({
    type: 'idle',
    message: '',
  });

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!mounted || !isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, mounted, onClose]);

  if (!mounted || !isOpen || !imageUrl) return null;

  const getSafeFileName = (value: string) => value.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 128);

  const getExtFromMime = (mime: string) => {
    const m = mime.toLowerCase();
    if (m.includes('png')) return 'png';
    if (m.includes('webp')) return 'webp';
    if (m.includes('jpeg') || m.includes('jpg')) return 'jpg';
    return 'jpg';
  };

  const uploadViaFormData = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', 'props');
    formData.append('name', name ? String(name) : file.name);
    const response = await fetch('/api/content-library/public-resources/upload', { method: 'POST', body: formData });
    const result = await response.json();
    if (!response.ok || !result?.success) {
      const message = typeof result?.message === 'string' ? result.message : '存入失败';
      throw new Error(message);
    }
    return result?.data;
  };

  const uploadViaImportApi = async () => {
    const response = await fetch('/api/content-library/public-resources/import-by-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: imageUrl,
        type: 'props',
        name: name || '',
        description: '',
      }),
    });
    const result = await response.json();
    if (!response.ok || !result?.success) {
      const message = typeof result?.message === 'string' ? result.message : '存入失败';
      throw new Error(message);
    }
    return result?.data;
  };

  const handleSaveToPublicLibrary = async () => {
    if (saving) return;
    setSaving(true);
    setSaveResult({ type: 'idle', message: '' });

    try {
      const res = await fetch(imageUrl);
      if (!res.ok) throw new Error(`图片下载失败: ${res.status}`);
      const blob = await res.blob();
      const ext = getExtFromMime(blob.type || '');
      const baseName = getSafeFileName(typeof name === 'string' && name.trim().length > 0 ? name.trim() : 'image');
      const fileName = baseName.includes('.') ? baseName : `${baseName}.${ext}`;
      const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' });

      await uploadViaFormData(file);
      setSaveResult({ type: 'success', message: '已存入公共素材库' });
    } catch (e) {
      try {
        await uploadViaImportApi();
        setSaveResult({ type: 'success', message: '已存入公共素材库' });
      } catch (e2) {
        const msg =
          e2 instanceof Error
            ? e2.message
            : e instanceof Error
              ? e.message
              : '存入失败';
        setSaveResult({ type: 'error', message: msg });
      }
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col md:flex-row max-h-[90vh]">
          <div className="flex-1 bg-black flex items-center justify-center p-2">
            <img
              src={imageUrl}
              alt={name}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
          </div>

          <div className="w-full md:w-80 flex-shrink-0 border-t md:border-t-0 md:border-l border-gray-200 bg-white p-4 flex flex-col gap-3 overflow-auto">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900 truncate">{name || '图片预览'}</div>
              </div>
              <button
                type="button"
                className="p-1 rounded-md hover:bg-gray-100 text-gray-600"
                onClick={onClose}
                title="关闭"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleSaveToPublicLibrary}
              disabled={saving}
              className={`w-full px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                saving
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-violet-600 hover:bg-violet-700 text-white'
              }`}
            >
              {saving ? '存入中...' : '存入公共素材库'}
            </button>

            {saveResult.type !== 'idle' && (
              <div
                className={`text-[11px] rounded-lg px-3 py-2 border ${
                  saveResult.type === 'success'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}
              >
                {saveResult.message}
              </div>
            )}

            <div className="text-[11px] text-gray-500 leading-relaxed">
              后续会在这里增加更多功能，例如下载、复制链接、设置为封面等。
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
