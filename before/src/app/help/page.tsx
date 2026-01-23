import Link from 'next/link';

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">帮助中心</h1>
          <p className="mt-2 text-gray-600">
            这里会沉淀平台使用说明、常见问题与最佳实践。
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Link
              href="/storyboard"
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:bg-gray-50"
            >
              <div className="font-semibold text-gray-900">从故事到分镜</div>
              <div className="mt-1 text-sm text-gray-600">如何快速生成可用的分镜脚本</div>
            </Link>
            <Link
              href="/video-creation"
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:bg-gray-50"
            >
              <div className="font-semibold text-gray-900">从分镜到成片</div>
              <div className="mt-1 text-sm text-gray-600">如何生成素材并完成合成</div>
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              返回首页
            </Link>
            <Link
              href="/content-library"
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              打开内容库
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

