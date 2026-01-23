import Link from 'next/link';
import { ReactNode } from 'react';

interface StoryboardWorkbenchHeaderProps {
  backHref: string;
  title: string;
  description?: string;
  rightActions?: ReactNode;
}

export function StoryboardWorkbenchHeader({
  backHref,
  title,
  description,
  rightActions,
}: StoryboardWorkbenchHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <Link
          href={backHref}
          className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          返回
        </Link>

        <h1 className="truncate text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-gray-600 sm:text-base">{description}</p> : null}
      </div>

      {rightActions ? <div className="flex shrink-0 items-center gap-2">{rightActions}</div> : null}
    </div>
  );
}

