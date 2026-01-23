'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Clapperboard,
  Image as ImageIcon,
  Library,
  Sparkles,
  Wand2,
  CheckCircle2,
  User,
  Lock,
  HelpCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface HomeLandingProps {
  onLogin: () => void;
}

export function HomeLanding({ onLogin }: HomeLandingProps) {
  const highlights = useMemo(
    () => [
      { label: '可上传参考图', icon: ImageIcon },
      { label: '内容库统一管理', icon: Library },
      { label: '脚本到成片闭环', icon: Clapperboard },
    ],
    []
  );

  const steps = useMemo(
    () => [
      {
        title: '输入故事',
        description: '粘贴原文或写个梗概，快速开始',
        icon: BookOpen,
      },
      {
        title: '生成分镜',
        description: '自动拆镜头、出脚本、补细节',
        icon: Wand2,
      },
      {
        title: '一键合成',
        description: '出图、配音、合成，快速成片',
        icon: Sparkles,
      },
    ],
    []
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-gradient-to-br from-indigo-200/50 to-purple-200/40 blur-3xl" />
        <div className="absolute -bottom-40 right-[-120px] h-[520px] w-[520px] rounded-full bg-gradient-to-br from-blue-200/40 to-indigo-200/30 blur-3xl" />
      </div>

      <header className="relative z-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <Link href="/" className="group flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30 transition-shadow group-hover:shadow-indigo-500/50">
              <Clapperboard className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                AI视频创作平台
              </span>
              <span className="text-[10px] font-medium tracking-wide text-gray-400">AI VIDEO CREATOR</span>
            </div>
          </Link>

          <nav className="hidden items-center gap-2 md:flex">
            <Link
              href="/storyboard"
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:text-indigo-600"
            >
              功能
            </Link>
            <Link
              href="/content-library"
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:text-indigo-600"
            >
              内容库
            </Link>
            <Link
              href="/help"
              className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:text-indigo-600"
            >
              <HelpCircle className="h-4 w-4" />
              帮助
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative z-10">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 pb-16 pt-8 sm:px-6 lg:grid-cols-12 lg:px-8 lg:pt-14">
          <section className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200/60 bg-white/60 px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm shadow-indigo-100/60 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              从故事到成片，效率提升一个数量级
            </div>

            <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
              AI 视频创作
              <span className="block bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                让灵感秒变作品
              </span>
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-relaxed text-gray-600 sm:text-lg">
              自动分镜、AI 出图、快速合成。把“想法”变成“可发布”的短视频工作流，集中在一个地方完成。
            </p>

            <div className="mt-7 flex flex-wrap gap-2">
              {highlights.map((item) => (
                <div
                  key={item.label}
                  className="inline-flex items-center gap-2 rounded-full border border-gray-200/70 bg-white/70 px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm shadow-gray-100/60 backdrop-blur"
                >
                  <item.icon className="h-3.5 w-3.5 text-indigo-600" />
                  {item.label}
                </div>
              ))}
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {steps.map((step, index) => (
                <div
                  key={step.title}
                  className="relative overflow-hidden rounded-2xl border border-gray-200/60 bg-white/70 p-5 shadow-xl shadow-indigo-100/40 backdrop-blur"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md shadow-indigo-500/20">
                      <step.icon className="h-5 w-5 text-white" />
                    </div>
                    <div className="text-xs font-bold text-gray-400">0{index + 1}</div>
                  </div>
                  <div className="mt-4 text-sm font-bold text-gray-900">{step.title}</div>
                  <div className="mt-1 text-sm leading-relaxed text-gray-600">{step.description}</div>
                </div>
              ))}
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link
                href="/storyboard"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200/70 bg-white/70 px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm shadow-gray-100/60 backdrop-blur transition-colors hover:text-indigo-700"
              >
                先看看剧本创作
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/video-creation"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200/70 bg-white/70 px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm shadow-gray-100/60 backdrop-blur transition-colors hover:text-indigo-700"
              >
                直接去视频创作
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>

          <aside className="lg:col-span-5">
            <div className="rounded-3xl border border-gray-200/60 bg-white/70 p-6 shadow-2xl shadow-indigo-100/50 backdrop-blur sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-gray-900">欢迎回来</div>
                  <div className="mt-1 text-xs leading-relaxed text-gray-500">体验版登录：用户名/密码可随意输入</div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md shadow-indigo-500/20">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700">用户名</label>
                  <div className="mt-2 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 focus-within:ring-2 focus-within:ring-indigo-500/25">
                    <User className="h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="请输入用户名（任意内容）"
                      className="w-full bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700">密码</label>
                  <div className="mt-2 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 focus-within:ring-2 focus-within:ring-indigo-500/25">
                    <Lock className="h-4 w-4 text-gray-400" />
                    <input
                      type="password"
                      placeholder="请输入密码（任意内容）"
                      className="w-full bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
                    />
                  </div>
                </div>

                <Button variant="gradient" size="lg" className="w-full" onClick={onLogin}>
                  登录进入工作台
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>

                <Button
                  variant="secondary"
                  size="lg"
                  className="w-full bg-white text-gray-800 hover:bg-gray-50"
                  type="button"
                >
                  第三方登录
                </Button>

                <div className="rounded-2xl border border-indigo-200/50 bg-gradient-to-r from-indigo-50/80 to-purple-50/80 p-4">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-indigo-600" />
                    <div className="text-xs leading-relaxed text-gray-700">
                      推荐流程：先做「剧本创作」生成分镜脚本，再进入「视频创作」合成视频。
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 text-center text-xs text-gray-500">
                还没有账号？<span className="font-semibold text-indigo-700">立即注册</span>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <footer className="relative z-10 border-t border-gray-200/60 bg-white/50 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div>© {new Date().getFullYear()} AI Video Creator</div>
          <div className="flex items-center gap-4">
            <Link href="/help" className="hover:text-indigo-700">
              帮助中心
            </Link>
            <Link href="/content-library" className="hover:text-indigo-700">
              内容库
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

