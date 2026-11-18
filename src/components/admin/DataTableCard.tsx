import type { ReactNode } from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Card wrapper for a data table, with an optional toolbar and footer. */
export function DataTableCard({
  toolbar,
  footer,
  children,
  busy,
  className,
  label,
}: {
  toolbar?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  busy?: boolean;
  className?: string;
  label?: string;
}) {
  return (
    <section
      aria-label={label}
      aria-busy={busy || undefined}
      className={cn(
        'overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-xs',
        className,
      )}
    >
      {toolbar ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-3 py-3 sm:px-4">
          {toolbar}
        </div>
      ) : null}
      <div className="w-full overflow-x-auto">{children}</div>
      {footer ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-3 py-2.5 sm:px-4">
          {footer}
        </div>
      ) : null}
    </section>
  );
}

/** Skeleton rows that keep the real row height while loading. */
export function SkeletonRows({
  rows = 6,
  columns,
}: {
  rows?: number;
  /** Class for each cell, so hidden responsive columns stay hidden. */
  columns: string[];
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow
          key={i}
          className="h-14 hover:bg-transparent"
        >
          {columns.map((cls, j) => (
            <TableCell
              key={j}
              className={cls}
            >
              {j === 0 ? (
                <div className="flex items-center gap-3">
                  <Skeleton className="size-8 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-full max-w-36" />
                    <Skeleton className="h-3 w-full max-w-44" />
                  </div>
                </div>
              ) : (
                <Skeleton className="h-3.5 w-16" />
              )}
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

/** "Page x of y · n items" left, Previous and Next right. */
export function TablePager({
  status,
  previousLabel,
  nextLabel,
  canPrevious,
  canNext,
  onPrevious,
  onNext,
}: {
  status: ReactNode;
  previousLabel: string;
  nextLabel: string;
  canPrevious: boolean;
  canNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <>
      <p className="text-xs tabular-nums text-muted-foreground">{status}</p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canPrevious}
          onClick={onPrevious}
        >
          {previousLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canNext}
          onClick={onNext}
        >
          {nextLabel}
        </Button>
      </div>
    </>
  );
}
