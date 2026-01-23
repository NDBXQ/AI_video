'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Clapperboard,
  Film,
  Image as ImageIcon,
  Library,
  Sparkles,
  Wand2,
  HelpCircle,
  Clock,
  FolderOpen,
} from 'lucide-react';

const quickActions = [
  {
    title: '新建剧本 / 分镜',
    description: '从故事出发，生成分镜脚本',
    href: '/storyboard',
    icon: BookOpen,
    variant: 'primary' as const,
  },
  {
    title: '从分镜生成视频',
    description: '进入视频创作，快速合成成片',
    href: '/video-creation',
    icon: Film,
    variant: 'secondary' as const,
  },
];

const coreCards = [
  {
    title: '剧本创作',
    description: '输入故事原文或剧情简介，自动生成分镜脚本',
    href: '/storyboard',
    icon: Wand2,
    color: 'from-indigo-500 to-purple-600',
    points: ['自动拆镜头与台词', '可迭代优化脚本细节', '与视频创作无缝衔接'],
  },
  {
    title: '视频创作',
    description: '基于分镜脚本生成素材并合成视频，支持上传素材',
    href: '/video-creation',
    icon: Clapperboard,
    color: 'from-blue-500 to-indigo-600',
    points: ['AI 出图 + 参考图', '快速合成与预览', '生成结果统一入库'],
  },
];

const shortcuts = [
  {
    title: '内容库',
    description: '统一管理脚本、图片、视频',
    href: '/content-library',
    icon: Library,
  },
  {
    title: '图库管理',
    description: '管理图片素材与参考图',
    href: '/content-library',
    icon: ImageIcon,
  },
  {
    title: '帮助中心',
    description: '查看使用说明与常见问题',
    href: '/help',
    icon: HelpCircle,
  },
];

export function HomeDashboard() {
  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-3xl border border-gray-200/60 bg-white p-6 shadow-xl shadow-indigo-100/40 sm:p-8">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 right-[-140px] h-[380px] w-[380px] rounded-full bg-gradient-to-br from-indigo-200/45 to-purple-200/35 blur-3xl" />
          <div className="absolute -bottom-28 left-[-160px] h-[420px] w-[420px] rounded-full bg-gradient-to-br from-blue-200/35 to-indigo-200/30 blur-3xl" />
        </div>

        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200/60 bg-white/70 px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm shadow-indigo-100/60">
            <Sparkles className="h-3.5 w-3.5" />
            工作台
          </div>

          <div className="mt-4 grid gap-6 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-7">
              <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                今天从哪里开始创作？
              </h1>
              <p className="mt-2 max-w-2xl text-base leading-relaxed text-gray-600">
                推荐先生成分镜脚本，再进入视频创作合成成片。流程更顺、结果更稳定。
              </p>
            </div>

            <div className="lg:col-span-5">
              <div className="grid gap-3 sm:grid-cols-2">
                {quickActions.map((item) => (
                  <Link
                    key={item.title}
                    href={item.href}
                    className={`group flex items-center justify-between gap-4 rounded-2xl border px-4 py-4 shadow-sm transition-colors ${
                      item.variant === 'primary'
                        ? 'border-indigo-200/60 bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700'
                        : 'border-gray-200 bg-white text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-bold">
                        <item.icon
                          className={`h-4 w-4 ${item.variant === 'primary' ? 'text-white' : 'text-indigo-600'}`}
                        />
                        <span className="truncate">{item.title}</span>
                      </div>
                      <div className={`mt-1 text-xs ${item.variant === 'primary' ? 'text-white/85' : 'text-gray-500'}`}>
                        {item.description}
                      </div>
                    </div>
                    <ArrowRight
                      className={`h-4 w-4 flex-shrink-0 transition-transform group-hover:translate-x-0.5 ${
                        item.variant === 'primary' ? 'text-white' : 'text-gray-400'
                      }`}
                    />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200/60 bg-white p-6 shadow-lg shadow-gray-100/60 sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
              <Clock className="h-4 w-4 text-indigo-600" />
              继续创作
            </div>
            <div className="mt-1 text-xs text-gray-500">最近项目会出现在这里</div>
          </div>
          <Link href="/content-library" className="text-xs font-semibold text-indigo-700 hover:text-indigo-800">
            查看全部
          </Link>
        </div>

        <div className="mt-5 rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-sm">
              <FolderOpen className="h-5 w-5 text-indigo-600" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-900">暂无最近项目</div>
              <div className="mt-1 text-xs leading-relaxed text-gray-500">
                先从「新建剧本 / 分镜」开始，创作内容会自动沉淀到内容库。
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href="/storyboard"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-gray-800 shadow-sm hover:bg-gray-50"
                >
                  去生成分镜
                  <ArrowRight className="h-3.5 w-3.5 text-gray-400" />
                </Link>
                <Link
                  href="/content-library"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-gray-800 shadow-sm hover:bg-gray-50"
                >
                  打开内容库
                  <ArrowRight className="h-3.5 w-3.5 text-gray-400" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        {coreCards.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="group relative overflow-hidden rounded-3xl border border-gray-200/60 bg-white p-6 shadow-xl shadow-indigo-100/35 transition-colors hover:bg-gray-50 sm:p-8"
          >
            <div
              className={`pointer-events-none absolute -top-24 right-[-140px] h-[340px] w-[340px] rounded-full bg-gradient-to-br ${card.color} opacity-10 blur-3xl`}
            />
            <div className="relative">
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md shadow-indigo-500/20">
                  <card.icon className="h-6 w-6 text-white" />
                </div>
                <ArrowRight className="h-5 w-5 text-gray-300 transition-transform group-hover:translate-x-1 group-hover:text-indigo-600" />
              </div>

              <div className="mt-5 text-xl font-extrabold text-gray-900">{card.title}</div>
              <div className="mt-2 text-sm leading-relaxed text-gray-600">{card.description}</div>

              <div className="mt-5 space-y-2">
                {card.points.map((p) => (
                  <div key={p} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-600" />
                    <span className="leading-relaxed">{p}</span>
                  </div>
                ))}
              </div>

              <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-indigo-700">
                立即开始
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </div>
            </div>
          </Link>
        ))}
      </section>

      <section className="rounded-3xl border border-gray-200/60 bg-white p-6 shadow-lg shadow-gray-100/60 sm:p-8">
        <div className="text-sm font-bold text-gray-900">快捷入口</div>
        <div className="mt-1 text-xs text-gray-500">常用入口集中在这里，减少来回跳转</div>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {shortcuts.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="group flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:bg-gray-50"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md shadow-indigo-500/20">
                <item.icon className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-gray-900">{item.title}</div>
                <div className="mt-1 text-xs text-gray-500">{item.description}</div>
              </div>
              <ArrowRight className="ml-auto h-4 w-4 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-600" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

