import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Centered empty state: icon tile, title, one sentence, then actions. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actions,
  className,
}: {
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        className,
      )}
    >
      <span className="inline-flex size-11 items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground">
        <Icon
          className="size-5"
          aria-hidden
        />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description ? (
          <p className="max-w-[48ch] text-[13px] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center justify-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
