import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

export interface SelectFieldProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: Array<SelectOption<T>>;
  disabled?: boolean;
  className?: string;
}

export function SelectField<T extends string>({
  value,
  onChange,
  options,
  disabled,
  className,
}: SelectFieldProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const selectedIndex = useMemo(() => Math.max(0, options.findIndex((o) => o.value === value)), [options, value]);
  const [activeIndex, setActiveIndex] = useState(selectedIndex);

  const selected = options[selectedIndex];

  useEffect(() => {
    setActiveIndex(selectedIndex);
  }, [selectedIndex]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const el = containerRef.current;
      if (!el) return;
      if (event.target instanceof Node && el.contains(event.target)) return;
      setOpen(false);
    };

    window.addEventListener('mousedown', onPointerDown);
    return () => window.removeEventListener('mousedown', onPointerDown);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!open) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const commit = (next: SelectOption<T>) => {
    onChange(next.value);
    setOpen(false);
  };

  const handleButtonKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(selectedIndex);
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setOpen((v) => !v);
      return;
    }
  };

  const handleListKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!open) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => Math.min(options.length - 1, i + 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const next = options[activeIndex];
      if (next) commit(next);
      return;
    }
  };

  return (
    <div ref={containerRef} className={cn('relative', className)} onKeyDown={handleListKeyDown}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={handleButtonKeyDown}
        className={cn(
          'flex h-11 w-full items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 text-left text-sm text-gray-900 transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300',
          disabled ? 'cursor-not-allowed opacity-60' : 'hover:bg-gray-50'
        )}
      >
        <div className="min-w-0">
          <div className="truncate font-medium text-gray-900">{selected?.label ?? value}</div>
          {selected?.description ? <div className="truncate text-xs text-gray-500">{selected.description}</div> : null}
        </div>
        <svg
          className={cn('h-4 w-4 shrink-0 text-gray-500 transition-transform', open ? 'rotate-180' : '')}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
          <div role="listbox" aria-activedescendant={`select-option-${activeIndex}`} className="max-h-72 overflow-auto">
            {options.map((opt, idx) => {
              const isSelected = opt.value === value;
              const isActive = idx === activeIndex;
              return (
                <button
                  key={opt.value}
                  id={`select-option-${idx}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => commit(opt)}
                  className={cn(
                    'flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors',
                    isActive ? 'bg-gray-50' : '',
                    isSelected ? 'bg-indigo-50 text-indigo-700' : 'text-gray-900'
                  )}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{opt.label}</div>
                    {opt.description ? (
                      <div className={cn('truncate text-xs', isSelected ? 'text-indigo-700/70' : 'text-gray-500')}>
                        {opt.description}
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                    {isSelected ? (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

