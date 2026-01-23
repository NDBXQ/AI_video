/**
 * 视频创作页面 - 模块化重构版本
 *
 * 采用自上而下的模块化设计：
 * - 领域层：定义类型、常量、验证逻辑
 * - 服务层：封装API调用
 * - Hooks层：管理状态和副作用
 * - 组件层：可复用的小组件
 * - 页面层：组装组件（<100行）
 */

import { Suspense } from 'react';
import { FullWidthLayout } from '@/components/layout/full-width-layout';
import { VideoCreationClient } from '@/features/video-creation/pages/VideoCreationClient';

export default function VideoCreationPage() {
  return (
    <FullWidthLayout>
      <Suspense
        fallback={
          <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
            <div className="text-center">
              <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto" />
              <p className="text-gray-500">加载页面...</p>
            </div>
          </div>
        }
      >
        <VideoCreationClient />
      </Suspense>
    </FullWidthLayout>
  );
}
