'use client';

import Link from 'next/link';
import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';

export default function StoryboardPage() {
  return (
    <MainLayout>
      <div className="space-y-8">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-3 lg:items-center">
            <div className="lg:col-span-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                AI 智能剧本创作
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">剧本创作</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-600 sm:text-base">
                先生成结构化故事大纲，再生成分镜场景文本。整体流程更清晰，产出更稳定。
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">两步完成</span>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">自动保存</span>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">可继续编辑</span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Link href="/storyboard/create/outline?type=original">
                <Button className="w-full rounded-xl bg-indigo-600 py-3 text-base font-semibold text-white hover:bg-indigo-700">
                  从故事原文开始
                </Button>
              </Link>
              <Link href="/storyboard/create/outline?type=brief">
                <Button
                  variant="secondary"
                  className="w-full rounded-xl bg-white py-3 text-base font-semibold text-gray-800 hover:bg-gray-50 ring-1 ring-gray-200"
                >
                  从剧情简介开始
                </Button>
              </Link>
              <Link href="/content-library" className="text-center text-sm font-medium text-gray-600 hover:text-gray-900">
                去内容库继续创作 →
              </Link>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">创作流程</h2>
            <div className="text-sm text-gray-500">建议按顺序完成</div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <Link
              href="/storyboard/create/outline"
              className="group rounded-2xl border border-gray-200 bg-white p-5 transition-colors hover:bg-gray-50"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-900 text-sm font-semibold text-white">
                      1
                    </div>
                    <div className="text-base font-semibold text-gray-900">生成故事大纲</div>
                  </div>
                  <div className="mt-2 text-sm leading-relaxed text-gray-600">
                    输入原文或简介，生成结构化场景列表，方便逐条检查与修改。
                  </div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-500 transition-colors group-hover:bg-white group-hover:text-gray-900 ring-1 ring-gray-200">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>

            <Link
              href="/storyboard/text"
              className="group rounded-2xl border border-gray-200 bg-white p-5 transition-colors hover:bg-gray-50"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-900 text-sm font-semibold text-white">
                      2
                    </div>
                    <div className="text-base font-semibold text-gray-900">生成场景文本</div>
                  </div>
                  <div className="mt-2 text-sm leading-relaxed text-gray-600">
                    基于大纲逐场景生成详细描述与分镜文本，准备进入视频创作。
                  </div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-500 transition-colors group-hover:bg-white group-hover:text-gray-900 ring-1 ring-gray-200">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">核心能力</h2>
            <div className="text-sm text-gray-500">更稳定、更可控</div>
          </div>

          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl bg-gray-50 p-5">
              <div className="text-sm font-semibold text-gray-900">产出质量</div>
              <div className="mt-3 space-y-3 text-sm text-gray-700">
                <div className="flex gap-3">
                  <div className="mt-2 h-1.5 w-1.5 rounded-full bg-indigo-500" />
                  <div>自动梳理人物、冲突、推进点，减少遗漏</div>
                </div>
                <div className="flex gap-3">
                  <div className="mt-2 h-1.5 w-1.5 rounded-full bg-indigo-500" />
                  <div>逐场景生成，结构一致，便于后续视频生成</div>
                </div>
                <div className="flex gap-3">
                  <div className="mt-2 h-1.5 w-1.5 rounded-full bg-indigo-500" />
                  <div>支持返回修改输入，再次生成对比</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-gray-50 p-5">
              <div className="text-sm font-semibold text-gray-900">效率体验</div>
              <div className="mt-3 space-y-3 text-sm text-gray-700">
                <div className="flex gap-3">
                  <div className="mt-2 h-1.5 w-1.5 rounded-full bg-indigo-500" />
                  <div>自动保存到内容库，随时继续编辑</div>
                </div>
                <div className="flex gap-3">
                  <div className="mt-2 h-1.5 w-1.5 rounded-full bg-indigo-500" />
                  <div>生成进度清晰可见，支持取消不中断已完成部分</div>
                </div>
                <div className="flex gap-3">
                  <div className="mt-2 h-1.5 w-1.5 rounded-full bg-indigo-500" />
                  <div>生成完成一键进入视频创作</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">最近创作</h3>
              <p className="mt-1 text-sm text-gray-600">从上次停止处继续，或新建一个剧本</p>
            </div>
            <Link href="/content-library" className="text-sm font-semibold text-indigo-700 hover:text-indigo-800">
              查看全部 →
            </Link>
          </div>

          <div className="divide-y divide-gray-100 rounded-2xl border border-gray-200">
            <Link
              href="/storyboard/text"
              className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-gray-50"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">已完成</span>
                  <span className="truncate text-sm font-semibold text-gray-900">都市爱情故事</span>
                </div>
                <div className="mt-1 text-sm text-gray-600">4 个场景 · 2 小时前</div>
              </div>
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>

            <Link
              href="/storyboard/text"
              className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-gray-50"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">草稿</span>
                  <span className="truncate text-sm font-semibold text-gray-900">科幻短片</span>
                </div>
                <div className="mt-1 text-sm text-gray-600">3 个场景 · 1 天前</div>
              </div>
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>

            <Link
              href="/storyboard/create/outline"
              className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-gray-50"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-900 text-xs font-semibold text-white">
                    +
                  </span>
                  <span className="truncate text-sm font-semibold text-gray-900">新建剧本</span>
                </div>
                <div className="mt-1 text-sm text-gray-600">从输入原文或简介开始</div>
              </div>
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
