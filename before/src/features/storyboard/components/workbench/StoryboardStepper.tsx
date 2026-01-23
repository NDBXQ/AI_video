import Link from 'next/link';

type StoryboardStep = 'outline' | 'text' | 'video';

interface StoryboardStepperProps {
  active: StoryboardStep;
  storyId?: string | null;
}

const stepMeta: Array<{ key: StoryboardStep; index: number; label: string }> = [
  { key: 'outline', index: 1, label: '故事大纲' },
  { key: 'text', index: 2, label: '场景文本' },
  { key: 'video', index: 3, label: '视频创作' },
];

function stepRank(step: StoryboardStep) {
  return stepMeta.find((s) => s.key === step)?.index ?? 1;
}

export function StoryboardStepper({ active, storyId }: StoryboardStepperProps) {
  const activeRank = stepRank(active);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4 sm:px-6">
      <div className="relative flex items-center justify-between gap-3">
        <div className="absolute left-4 right-4 top-6 h-px bg-gray-200 sm:left-6 sm:right-6" />

        {stepMeta.map((s) => {
          const isDone = s.index < activeRank;
          const isActive = s.index === activeRank;
          const isFuture = s.index > activeRank;
          const canGoVideo = s.key === 'video' && !!storyId;

          const node = (
            <div className="relative z-10 flex flex-col items-center gap-2">
              <div
                className={[
                  'flex h-12 w-12 items-center justify-center rounded-xl text-sm font-semibold transition-colors',
                  isDone ? 'bg-gray-900 text-white' : '',
                  isActive ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200' : '',
                  isFuture ? 'bg-gray-100 text-gray-500' : '',
                ].join(' ')}
              >
                {isDone ? (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  s.index
                )}
              </div>
              <div
                className={[
                  'text-xs font-medium',
                  isActive ? 'text-gray-900' : '',
                  isDone ? 'text-gray-900' : '',
                  isFuture ? 'text-gray-500' : '',
                ].join(' ')}
              >
                {s.label}
              </div>
            </div>
          );

          if (canGoVideo) {
            return (
              <Link
                key={s.key}
                href={`/video-creation?storyId=${storyId}`}
                className="rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                {node}
              </Link>
            );
          }

          return (
            <div key={s.key} className={isFuture ? 'opacity-70' : ''}>
              {node}
            </div>
          );
        })}
      </div>
    </div>
  );
}

