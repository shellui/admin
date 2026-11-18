import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  variant = 'pill',
}: {
  variant?: 'pill' | 'underline';
  label: string;
  value: T;
  options: Array<{ value: T; label: string; icon?: ReactNode }>;
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={
        variant === 'underline'
          ? 'flex w-full gap-4 overflow-x-auto border-b border-border'
          : 'inline-flex rounded-md border border-border bg-muted/40 p-0.5'
      }
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            className={cn(
              variant === 'underline'
                ? '-mb-px inline-flex h-10 items-center gap-1.5 border-b-2 px-0.5 text-sm transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none [&_svg]:size-4'
                : 'inline-flex h-8 items-center gap-1.5 rounded px-3 text-sm transition-colors [&_svg]:size-4',
              variant === 'underline'
                ? selected
                  ? 'border-primary font-medium text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
                : selected
                  ? 'bg-background font-medium text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => onChange(option.value)}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
