'use client';

import { Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function BulkActionBar({
  selectedCount,
  onClear,
  canDelete,
  onDelete,
}: {
  selectedCount: number;
  onClear: () => void;
  canDelete: boolean;
  onDelete: () => void;
}) {
  if (selectedCount <= 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-50 w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2">
      <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white/95 p-3 shadow-lg backdrop-blur">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
          已选择 {selectedCount} 项
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onClear} className="rounded-xl">
            <X className="mr-1.5 h-4 w-4" />
            清空
          </Button>
          {canDelete ? (
            <Button
              variant="danger"
              size="sm"
              className="rounded-xl"
              onClick={() => {
                const ok = window.confirm(`确认删除已选择的 ${selectedCount} 项吗？`);
                if (!ok) return;
                onDelete();
              }}
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              删除
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
