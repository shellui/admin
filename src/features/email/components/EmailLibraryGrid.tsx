import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Text } from '@/components/ui/text';
import { SegmentedControl } from '@/features/email/components/SegmentedControl';
import { libraryPreviewHtml, librarySections } from '@/lib/emailLibrary';
import type { EmailLibrary, EmailLibraryTemplate } from '@/lib/emailTypes';
import { cn } from '@/lib/utils';

const ALL = 'all';

function Thumbnail({ html, title }: { html: string; title: string }) {
  return (
    <div className="relative h-60 overflow-hidden rounded-t-md border-b border-border bg-white">
      {html ? (
        <iframe
          title={title}
          sandbox=""
          loading="lazy"
          tabIndex={-1}
          srcDoc={html}
          className="pointer-events-none absolute left-0 top-0 h-[1500px] w-[640px] origin-top-left scale-[0.4]"
        />
      ) : null}
    </div>
  );
}

/** Library designs by set, each with a small rendered preview. */
export function EmailLibraryGrid({
  library,
  assetsUrl,
  selectedId,
  onSelect,
  actions,
}: {
  library: EmailLibrary;
  assetsUrl: string;
  selectedId?: number | null;
  /** Makes each card a choice, for picking the design of an event email. */
  onSelect?: (template: EmailLibraryTemplate) => void;
  actions?: (template: EmailLibraryTemplate) => ReactNode;
}) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState(ALL);
  const sections = useMemo(
    () => librarySections(library.sets, library.templates, t('emailLibraryCompany')),
    [library, t],
  );
  const visible = filter === ALL ? sections : sections.filter((section) => section.key === filter);

  if (!sections.length) return <Text>{t('emailLibraryEmpty')}</Text>;

  return (
    <div className="space-y-6">
      {sections.length > 1 ? (
        <div className="overflow-x-auto">
          <SegmentedControl
            label={t('emailLibrarySetFilter')}
            value={filter}
            onChange={setFilter}
            options={[
              { value: ALL, label: t('emailLibraryAll') },
              ...sections.map((section) => ({ value: section.key, label: section.name })),
            ]}
          />
        </div>
      ) : null}
      {visible.map((section) => (
        <section
          key={section.key}
          className="space-y-3"
          aria-label={section.name}
        >
          <h2 className="text-lg font-semibold tracking-tight">{section.name}</h2>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(256px,1fr))] gap-4">
            {section.templates.map((template) => {
              const selected = selectedId === template.id;
              const card = (
                <>
                  <Thumbnail
                    html={template.html ? libraryPreviewHtml(template.html, assetsUrl) : ''}
                    title={template.name}
                  />
                  <div className="flex items-start justify-between gap-2 p-3">
                    <div className="min-w-0 space-y-1 text-left">
                      <p className="truncate text-sm font-medium">{template.name}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {template.key}
                      </p>
                    </div>
                    {selected ? (
                      <Check
                        aria-hidden
                        className="size-4 shrink-0 text-primary"
                      />
                    ) : template.builtIn ? null : (
                      <Badge variant="outline">{t('emailLibraryCustomBadge')}</Badge>
                    )}
                  </div>
                </>
              );
              return (
                <li
                  key={template.id}
                  className={cn(
                    'overflow-hidden rounded-md border bg-card',
                    selected ? 'border-primary ring-1 ring-primary' : 'border-border',
                  )}
                >
                  {onSelect ? (
                    <button
                      type="button"
                      className="block w-full"
                      aria-pressed={selected}
                      onClick={() => onSelect(template)}
                    >
                      {card}
                    </button>
                  ) : (
                    card
                  )}
                  {actions ? (
                    <div className="flex flex-wrap gap-2 px-3 pb-3">{actions(template)}</div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
