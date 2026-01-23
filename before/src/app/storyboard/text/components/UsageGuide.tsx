/**
 * 使用说明组件
 */

import { USAGE_STEPS, PROFESSIONAL_TIP } from '../constants';

export function UsageGuide() {
  return (
    <div className="space-y-4">
      {/* 使用说明卡片 */}
      <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-gray-900">使用说明</h3>
        </div>
        <div className="space-y-3">
          {USAGE_STEPS.map((item) => (
            <div key={item.step} className="flex gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-bold text-white shadow-sm">
                {item.step}
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900">{item.title}</div>
                <div className="mt-0.5 text-xs text-gray-600">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 提示卡片 */}
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
        <div className="flex items-start gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100">
            <svg className="h-4 w-4 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-amber-900">{PROFESSIONAL_TIP.title}</h4>
            <p className="mt-1 text-xs leading-relaxed text-amber-800">{PROFESSIONAL_TIP.content}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
