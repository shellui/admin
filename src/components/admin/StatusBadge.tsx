import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type StatusTone = 'success' | 'warning' | 'info' | 'destructive' | 'gold' | 'muted';

/** Status badge with a dot. Tones follow the theme through color-mix. */
export function StatusBadge({
  tone,
  children,
  dot = true,
  className,
  title,
}: {
  tone: StatusTone;
  children: ReactNode;
  dot?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        `tone-${tone}`,
        'inline-flex h-5 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-1.5 text-[11.5px] font-medium leading-none',
        className,
      )}
    >
      {dot ? (
        <span
          className="size-1.5 rounded-full bg-current"
          aria-hidden
        />
      ) : null}
      {children}
    </span>
  );
}

/** Rounded muted pill for tags such as group names. */
export function TagPill({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex h-5 max-w-[10rem] items-center truncate rounded-full border border-border bg-muted px-2 text-[11.5px] text-foreground"
    >
      {children}
    </span>
  );
}
