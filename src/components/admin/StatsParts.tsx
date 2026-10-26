import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type StatColumn = { label: ReactNode; className?: string };

/** Small card with a title and a compact table, or an empty line when there are no rows. */
export function StatTableCard({
  title,
  description,
  columns,
  rows,
  empty,
  footer,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  columns: StatColumn[];
  rows: { key: string; cells: ReactNode[] }[];
  empty: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'min-w-0 overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm',
        className,
      )}
    >
      <header className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </header>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border">
                {columns.map((c, i) => (
                  <th
                    key={i}
                    scope="col"
                    className={cn('px-4 py-2 font-medium', c.className)}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.key}
                  className="border-b border-border/60 last:border-0"
                >
                  {r.cells.map((cell, i) => (
                    <td
                      key={i}
                      className={cn('px-4 py-2', columns[i]?.className)}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {footer ? (
        <footer className="border-t border-border px-4 py-2 font-mono text-xs text-muted-foreground">
          {footer}
        </footer>
      ) : null}
    </section>
  );
}

/** Bar chart with a title tooltip per bar and an sr-only table with the same data. */
export function BarSeriesCard({
  title,
  description,
  bars,
  dayLabel,
  valueLabel,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  bars: {
    key: string;
    label: string;
    value: number;
    pct: number;
    title: string;
    recent?: boolean;
  }[];
  dayLabel: string;
  valueLabel: string;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'min-w-0 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm',
        className,
      )}
    >
      <h2 className="text-sm font-semibold">{title}</h2>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      <div
        className="mt-4 flex h-32 items-end gap-1"
        aria-hidden
      >
        {bars.map((b) => (
          <div
            key={b.key}
            className="flex h-full min-w-0 flex-1 items-end rounded-sm bg-muted"
            title={b.title}
          >
            <div
              className={cn('w-full rounded-sm', 'bg-primary', !b.recent && 'opacity-40')}
              style={{ height: `${Math.max(b.pct, b.value > 0 ? 4 : 0)}%` }}
            />
          </div>
        ))}
      </div>
      {bars.length > 0 ? (
        <div
          className="mt-1.5 flex justify-between font-mono text-[11px] text-muted-foreground"
          aria-hidden
        >
          <span>{bars[0].label}</span>
          <span>{bars[bars.length - 1].label}</span>
        </div>
      ) : null}
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">{dayLabel}</th>
            <th scope="col">{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {bars.map((b) => (
            <tr key={b.key}>
              <td>{b.label}</td>
              <td>{b.title}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
