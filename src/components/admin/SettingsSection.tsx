import type { ReactNode } from 'react';
import { BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  id?: string;
  title: ReactNode;
  description?: ReactNode;
  docs?: { href: string; label: string; external?: boolean };
  /** Status or API note shown left in the footer bar. */
  footerNote?: ReactNode;
  /** Save button or other action shown right in the footer bar. */
  footerAction?: ReactNode;
  children: ReactNode;
  className?: string;
  busy?: boolean;
};

/**
 * Settings section: title, one line and an optional docs link on the left,
 * a card with fields on the right, and a footer bar that saves this section.
 */
export function SettingsSection({
  id,
  title,
  description,
  docs,
  footerNote,
  footerAction,
  children,
  className,
  busy,
}: Props) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section
      aria-labelledby={headingId}
      aria-busy={busy || undefined}
      className={cn(
        'grid gap-4 border-b border-border pb-8 last:border-b-0 last:pb-0 md:grid-cols-[260px_minmax(0,1fr)] md:gap-8',
        className,
      )}
    >
      <div className="space-y-1.5">
        <h2
          id={headingId}
          className="font-heading text-[15px] font-semibold leading-6 text-foreground"
        >
          {title}
        </h2>
        {description ? (
          <p className="text-[13px] leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
        {docs ? (
          <a
            href={docs.href}
            {...(docs.external === false ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary-ink"
          >
            <BookOpen
              className="size-3.5"
              aria-hidden
            />
            {docs.label}
          </a>
        ) : null}
      </div>
      <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-xs">
        <div className="space-y-5 p-4 sm:p-5">{children}</div>
        {footerNote || footerAction ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/60 px-4 py-3 sm:px-5">
            <div
              className="min-w-0 flex-1 text-xs text-muted-foreground"
              aria-live="polite"
            >
              {footerNote}
            </div>
            {footerAction ? <div className="flex items-center gap-2">{footerAction}</div> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** Boolean setting: title and explanation left, control right. */
export function SettingRow({
  title,
  titleId,
  description,
  descriptionId,
  badge,
  control,
}: {
  title: ReactNode;
  titleId?: string;
  description?: ReactNode;
  descriptionId?: string;
  badge?: ReactNode;
  control: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border pb-4 last:border-b-0 last:pb-0">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            id={titleId}
            className="text-[13.5px] font-semibold text-foreground"
          >
            {title}
          </span>
          {badge}
        </div>
        {description ? (
          <div
            id={descriptionId}
            className="max-w-[60ch] text-[12.5px] leading-relaxed text-muted-foreground"
          >
            {description}
          </div>
        ) : null}
      </div>
      <div className="shrink-0 pt-0.5">{control}</div>
    </div>
  );
}
