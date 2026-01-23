'use client';

import { MainLayout } from '@/components/layout/main-layout';
import { ContentLibrary } from '@/features/content-library/ContentLibrary';

export default function ContentLibraryPage() {
  return (
    <MainLayout>
      <ContentLibrary />
    </MainLayout>
  );
}
