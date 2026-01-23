'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { LibraryHeader } from './components/LibraryHeader';
import { LibraryTabs } from './components/LibraryTabs';
import { LibrarySidebar } from './components/LibrarySidebar';
import { LibraryToolbar } from './components/LibraryToolbar';
import { BulkActionBar } from './components/BulkActionBar';
import { DetailsModal } from './components/modals/DetailsModal';
import { UploadPublicResourceModal } from './components/modals/UploadPublicResourceModal';
import { AiGeneratePublicResourceModal } from './components/modals/AiGeneratePublicResourceModal';
import { PublicPane } from './components/PublicPane';
import { WorksPane } from './components/WorksPane';
import type { DetailsItem, LibraryScope, PublicSection, SortKey, ViewMode, WorksItem, WorksSection } from './domain/types';
import { useWorksLibrary } from './hooks/useWorksLibrary';
import { usePublicResources } from './hooks/usePublicResources';
import { useStoryboardScripts } from './hooks/useStoryboardScripts';
import { usePublicResourceStats } from './hooks/usePublicResourceStats';
import { getWorksItemId, getWorksItemSearchText, sortWorksItems } from './utils/items';

export function ContentLibrary() {
  const [scope, setScope] = useState<LibraryScope>('works');
  const [worksSection, setWorksSection] = useState<WorksSection>('drafts');
  const [publicSection, setPublicSection] = useState<PublicSection>('all');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('recent');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [details, setDetails] = useState<DetailsItem | null>(null);
  const [publicUploadOpen, setPublicUploadOpen] = useState(false);
  const [publicAiOpen, setPublicAiOpen] = useState(false);

  const { drafts, completed, loading } = useWorksLibrary();

  const publicDb = usePublicResources({
    type: publicSection,
    search,
    sort: sortKey,
    enabled: scope === 'public',
  });
  const publicStats = usePublicResourceStats(scope === 'public');

  const publicResources = publicDb.items;

  const scriptsList = useStoryboardScripts({
    search,
    sort: sortKey,
    enabled: scope === 'works' && worksSection === 'scripts',
  });
  const scriptsCount = useStoryboardScripts({
    search: '',
    sort: 'recent',
    enabled: scope === 'works',
    limit: 0,
  });

  const worksCounts = useMemo(
    () => ({
      drafts: drafts.length,
      videos: completed.length,
      scripts: scriptsCount.total,
    }),
    [drafts.length, completed.length, scriptsCount.total]
  );

  const publicCounts = useMemo(() => publicStats.data as Record<PublicSection, number>, [publicStats.data]);

  const worksItems: WorksItem[] = useMemo(() => {
    if (worksSection === 'drafts') {
      return drafts.map((story) => ({ kind: 'draft', story }));
    }
    if (worksSection === 'videos') {
      return completed.map((story) => ({ kind: 'video', story }));
    }
    return scriptsList.items.map((script) => ({ kind: 'script', script }));
  }, [worksSection, drafts, completed, scriptsList.items]);

  const filteredWorksItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const base = keyword
      ? worksItems.filter((item) => getWorksItemSearchText(item).toLowerCase().includes(keyword))
      : worksItems;
    return sortWorksItems(base, sortKey);
  }, [worksItems, search, sortKey]);

  const filteredPublicResources = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const byType =
      publicSection === 'all' ? publicResources : publicResources.filter((r) => r.type === publicSection);
    const base = keyword
      ? byType.filter((r) => `${r.name} ${r.description} ${r.tags.join(' ')}`.toLowerCase().includes(keyword))
      : byType;
    const sorted = [...base].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    if (sortKey === 'title') return sorted;
    if (sortKey === 'oldest') return sorted.reverse();
    return sorted;
  }, [publicResources, publicSection, search, sortKey]);

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelected = () => setSelectedIds(new Set());

  const resultsCount = scope === 'works' ? filteredWorksItems.length : filteredPublicResources.length;
  const canBulkDelete = scope === 'public';

  const bulkDelete = async () => {
    if (!canBulkDelete) return;
    const ids = Array.from(selectedIds);
    if (ids.length <= 0) return;
    try {
      const res = await fetch('/api/content-library/public-resources', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const json = await res.json();
      if (!json?.success) {
        console.error('[bulkDelete] failed:', json);
        return;
      }
      clearSelected();
      publicDb.reload();
      publicStats.reload();
    } catch (error) {
      console.error('[bulkDelete] failed:', error);
    }
  };

  return (
    <div className="space-y-5">
      <LibraryHeader />

      <div className="flex items-center justify-between gap-4">
        <LibraryTabs
          value={scope}
          onChange={(next) => {
            setScope(next);
            setSelectedIds(new Set());
            setSearch('');
          }}
        />
        <div className="text-sm text-gray-600">
          结果 <span className="font-semibold text-gray-900">{resultsCount}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
        <LibrarySidebar
          mode={scope}
          worksSection={worksSection}
          publicSection={publicSection}
          worksCounts={worksCounts}
          publicCounts={publicCounts}
          onWorksSectionChange={(v) => {
            setWorksSection(v);
            setSelectedIds(new Set());
          }}
          onPublicSectionChange={(v) => {
            setPublicSection(v);
            setSelectedIds(new Set());
          }}
        />

        <div className="space-y-4">
          <LibraryToolbar
            search={search}
            onSearchChange={setSearch}
            sortKey={sortKey}
            onSortKeyChange={setSortKey}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            actions={
              scope === 'public' ? (
                <>
                  <button
                    type="button"
                    onClick={() => setPublicUploadOpen(true)}
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    上传素材
                  </button>
                  <button
                    type="button"
                    onClick={() => setPublicAiOpen(true)}
                    className="rounded-xl bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-black"
                  >
                    AI 生成
                  </button>
                </>
              ) : null
            }
          />

          {scope === 'works' ? (
            <WorksPane
              loading={worksSection === 'scripts' ? scriptsList.loading : loading}
              items={filteredWorksItems}
              viewMode={viewMode}
              selectedIds={selectedIds}
              onToggleSelected={toggleSelected}
              onOpenDetails={(next) => setDetails(next)}
            />
          ) : (
            <PublicPane
              resources={filteredPublicResources}
              viewMode={viewMode}
              selectedIds={selectedIds}
              onToggleSelected={toggleSelected}
              onOpenDetails={(next) => setDetails(next)}
            />
          )}
        </div>
      </div>

      <BulkActionBar selectedCount={selectedIds.size} onClear={clearSelected} canDelete={canBulkDelete} onDelete={bulkDelete} />
      <DetailsModal open={details != null} item={details} onClose={() => setDetails(null)} />

      <UploadPublicResourceModal
        open={publicUploadOpen}
        onClose={() => setPublicUploadOpen(false)}
        onUploaded={() => {
          publicDb.reload();
          publicStats.reload();
        }}
      />
      <AiGeneratePublicResourceModal
        open={publicAiOpen}
        onClose={() => setPublicAiOpen(false)}
        onGenerated={() => {
          publicDb.reload();
          publicStats.reload();
        }}
      />
    </div>
  );
}
