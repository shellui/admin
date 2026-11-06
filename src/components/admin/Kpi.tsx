import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** One KPI: icon and label, big number, one hint line. */
export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-xs">
      <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
        {Icon ? (
          <Icon
            className="size-3.5 shrink-0"
            aria-hidden
          />
        ) : null}
        <span className="truncate">{label}</span>
      </p>
      <p className="mt-1.5 font-heading text-2xl font-semibold tabular-nums tracking-tight">
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** KPI grid: 4 columns by default, 3 or 6 on request; 2 columns on mobile. */
export function KpiRow({
  columns = 4,
  label,
  children,
  className,
}: {
  columns?: 3 | 4 | 6;
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={label ? 'group' : undefined}
      aria-label={label}
      className={cn(
        'grid grid-cols-2 gap-3',
        columns === 3 && 'md:grid-cols-3',
        columns === 4 && 'md:grid-cols-4',
        columns === 6 && 'md:grid-cols-3 xl:grid-cols-6',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Placeholder row with the same height as loaded KPI cards. */
export function KpiSkeletonRow({ columns = 4, label }: { columns?: 3 | 4 | 6; label: string }) {
  return (
    <KpiRow
      columns={columns}
      className="motion-safe:animate-pulse"
    >
      <span className="sr-only">{label}</span>
      {Array.from({ length: columns }).map((_, i) => (
        <div
          key={i}
          className="space-y-2 rounded-xl border border-border bg-card p-4"
          aria-hidden
        >
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-3 w-28" />
        </div>
      ))}
    </KpiRow>
  );
}

/** Service block header: title, service chip, optional link right. */
export function ServiceSectionHeader({
  id,
  title,
  service,
  link,
}: {
  id?: string;
  title: ReactNode;
  service?: string;
  link?: { to: string; label: string; external?: boolean };
}) {
  return (
    <div className="mb-3 mt-2 flex items-center gap-2.5">
      <h2
        id={id}
        className="font-heading text-[15px] font-semibold"
      >
        {title}
      </h2>
      {service ? (
        <span className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground">
          {service}
        </span>
      ) : null}
      {link ? (
        link.external ? (
          <a
            href={link.to}
            className="ml-auto inline-flex items-center gap-1 text-[13px] text-muted-foreground no-underline hover:text-foreground"
          >
            {link.label}
            <ArrowRight
              className="size-3.5"
              aria-hidden
            />
          </a>
        ) : (
          <Link
            to={link.to}
            className="ml-auto inline-flex items-center gap-1 text-[13px] text-muted-foreground no-underline hover:text-foreground"
          >
            {link.label}
            <ArrowRight
              className="size-3.5"
              aria-hidden
            />
          </Link>
        )
      ) : null}
    </div>
  );
}
