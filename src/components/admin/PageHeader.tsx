import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

type BackLink = { to: string; label: string };

type Props = {
  title: ReactNode;
  /** Service chip shown next to the title, for example `shellui-auth`. */
  service?: string;
  description?: ReactNode;
  /** Secondary actions first, one primary action last. */
  actions?: ReactNode;
  back?: BackLink;
  className?: string;
};

/** One `h1` per page, with an optional service chip, description and actions. */
export function PageHeader({ title, service, description, actions, back, className }: Props) {
  return (
    <header className={cn('space-y-3', className)}>
      {back ? (
        <Link
          to={back.to}
          className="inline-flex items-center gap-1 rounded-md text-sm text-muted-foreground no-underline transition-colors hover:text-foreground hover:no-underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft
            className="size-4"
            aria-hidden
          />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-heading text-2xl font-semibold leading-8 tracking-tight text-foreground">
              {title}
            </h1>
            {service ? (
              <span className="inline-flex h-6 items-center rounded-md border border-border bg-muted/60 px-2 font-mono text-[11.5px] text-muted-foreground">
                {service}
              </span>
            ) : null}
          </div>
          {description ? (
            <p className="max-w-[64ch] text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
