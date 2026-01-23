'use client';

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { PublicResource } from '@/types';

export function AiGeneratePublicResourceModal({
  open,
  onClose,
  onGenerated,
}: {
  open: boolean;
  onClose: () => void;
  onGenerated: () => void;
}) {
  const [type, setType] = useState<Extract<PublicResource['type'], 'character' | 'background' | 'props'>>('character');
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [applicableScenes, setApplicableScenes] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => prompt.trim().length > 0 && !submitting, [prompt, submitting]);

  const submit = async () => {
    try {
      setSubmitting(true);
      setError(null);
      const res = await fetch('/api/content-library/public-resources/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          name: name.trim().length > 0 ? name.trim() : undefined,
          prompt: prompt.trim(),
          description: description.trim().length > 0 ? description.trim() : undefined,
          tags: tags.trim().length > 0 ? tags.trim() : undefined,
          applicableScenes: applicableScenes.trim().length > 0 ? applicableScenes.trim() : undefined,
          quantity,
        }),
      });
      const data = await res.json();
      if (!data?.success) {
        setError(data?.message || '生成失败');
        return;
      }
      onGenerated();
      onClose();
      setName('');
      setPrompt('');
      setDescription('');
      setTags('');
      setApplicableScenes('');
      setQuantity(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="关闭" />
      <div className="absolute left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="text-sm font-semibold text-gray-900">AI 生成公共资源</div>
          <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-gray-600 hover:bg-gray-50" aria-label="关闭">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-900">资源类型</div>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-gray-900"
              >
                <option value="character">角色库</option>
                <option value="background">背景库</option>
                <option value="props">道具库</option>
              </select>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-900">生成数量</div>
              <select
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-gray-900"
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-900">名称</div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="可选"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-900"
              />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-900">标签</div>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="逗号分隔，如：商务,正式"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-900"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-900">提示词</div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="例如：适合商务场景的男性角色形象，写实风格，高清"
              rows={4}
              className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-900"
            />
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-900">描述</div>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="可选（为空则使用提示词）"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-900"
            />
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-900">适用场景</div>
            <input
              value={applicableScenes}
              onChange={(e) => setApplicableScenes(e.target.value)}
              placeholder="逗号分隔，如：广告,宣传片"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-900"
            />
          </div>

          {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              取消
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {submitting ? '生成中…' : '生成'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

