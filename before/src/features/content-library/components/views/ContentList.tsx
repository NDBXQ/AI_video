import type { ReactNode } from 'react';

export function ContentList({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <div className="divide-y divide-gray-100">{children}</div>
    </div>
  );
}

