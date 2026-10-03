import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Text } from '@/components/ui/text';
import {
  ActionFeedback,
  type ActionFeedbackState,
} from '@/features/email/components/ActionFeedback';
import { askThemeSwitch } from '@/lib/themeSwitch';
import type { EmailTheme } from '@/lib/emailTypes';

export function EmailThemeSection({
  themes,
  currentKey,
  otherCount,
  previews,
  feedback,
  onApply,
}: {
  themes: EmailTheme[];
  currentKey: string;
  otherCount: number;
  /** HTML from `preview_url`, `null` when the preview request failed. */
  previews: Record<string, string | null | undefined>;
  feedback: ActionFeedbackState | null;
  onApply: (themeKey: string, applyToExisting: boolean) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  async function choose(theme: EmailTheme) {
    if (busyKey || theme.key === currentKey) return;
    setBusyKey(theme.key);
    try {
      const choice = await askThemeSwitch({
        otherCount,
        title: t('emailThemeSwitchTitle'),
        description: t('emailThemeSwitchDescription', { count: otherCount, name: theme.name }),
        allLabel: t('emailThemeSwitchAll'),
        newLabel: t('emailThemeSwitchNew'),
        cancelLabel: t('actionsCancel'),
      });
      if (choice === 'cancel') return;
      await onApply(theme.key, choice === 'all');
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">{t('emailThemeSection')}</h2>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {themes.map((theme) => {
          const current = theme.key === currentKey;
          const preview = previews[theme.key];
          return (
            <li key={theme.key}>
              <button
                type="button"
                className="flex h-full w-full flex-col gap-2 rounded-md border border-border p-3 text-left hover:bg-muted/40 disabled:hover:bg-transparent"
                aria-pressed={current}
                disabled={current || busyKey !== null}
                onClick={() => void choose(theme)}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{theme.name}</span>
                  {current ? <Badge variant="secondary">{t('emailThemeCurrent')}</Badge> : null}
                </div>
                <div className="h-28 w-full overflow-hidden rounded-sm border border-border bg-background">
                  {preview ? (
                    <iframe
                      title={theme.name}
                      sandbox=""
                      srcDoc={preview}
                      tabIndex={-1}
                      className="pointer-events-none h-[28rem] w-[40rem] origin-top-left scale-[0.28]"
                    />
                  ) : preview === null ? (
                    <Text className="p-2 text-xs text-muted-foreground">
                      {t('emailPreviewUnavailable')}
                    </Text>
                  ) : null}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      <ActionFeedback feedback={feedback} />
    </section>
  );
}
