import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Monospace code block for snippets, payloads and raw output. */
export function CodeBlock({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <pre
      className={cn(
        'm-0 overflow-auto rounded-lg border border-border bg-muted px-3.5 py-3 font-mono text-xs leading-relaxed text-foreground',
        className,
      )}
    >
      {children}
    </pre>
  );
}

/** Definition list in a 4 column grid (2 on mobile). */
export function DefinitionList({
  items,
  className,
}: {
  items: { term: ReactNode; value: ReactNode; key?: string }[];
  className?: string;
}) {
  return (
    <dl className={cn('m-0 grid grid-cols-2 gap-x-5 gap-y-4 md:grid-cols-4', className)}>
      {items.map((item, i) => (
        <div
          key={item.key ?? i}
          className="min-w-0"
        >
          <dt className="text-[12.5px] text-muted-foreground">{item.term}</dt>
          <dd className="m-0 mt-0.5 truncate font-medium text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Grid of bordered checkbox tiles. */
export function CheckTiles({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid gap-2 sm:grid-cols-2', className)}>{children}</div>;
}

export function CheckTile({
  control,
  label,
  hint,
  htmlFor,
}: {
  control: ReactNode;
  label: ReactNode;
  hint?: ReactNode;
  htmlFor: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 transition-colors duration-150 ease-soft hover:bg-muted/60 has-focus-visible:ring-2 has-focus-visible:ring-ring"
    >
      {control}
      <span className="min-w-0 truncate text-sm">{label}</span>
      {hint ? <small className="ml-auto text-xs text-muted-foreground">{hint}</small> : null}
    </label>
  );
}

/** Card with a destructive border for irreversible actions. */
export function DangerCard({
  title,
  description,
  action,
  id,
}: {
  title: ReactNode;
  description: ReactNode;
  action: ReactNode;
  id?: string;
}) {
  return (
    <section
      aria-labelledby={id}
      className="rounded-xl border bg-card shadow-xs border-[color-mix(in_oklab,var(--destructive)_35%,var(--border))]"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
        <div className="min-w-0 space-y-1">
          <h2
            id={id}
            className="font-heading text-[15px] font-semibold text-destructive"
          >
            {title}
          </h2>
          <p className="max-w-[64ch] text-[13px] text-muted-foreground">{description}</p>
        </div>
        {action}
      </div>
    </section>
  );
}
