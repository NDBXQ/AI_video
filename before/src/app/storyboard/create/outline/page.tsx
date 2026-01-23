import { Suspense } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { StoryboardOutlineClient } from '@/features/storyboard/pages/StoryboardOutlineClient';

export default function StoryboardOutlinePage() {
  return (
    <MainLayout>
      <Suspense
        fallback={
          <div className="flex h-96 items-center justify-center">
            <div className="text-center">
              <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto" />
              <p className="text-gray-500">加载页面...</p>
            </div>
          </div>
        }
      >
        <StoryboardOutlineClient />
      </Suspense>
    </MainLayout>
  );
}
