import { useTranslation } from 'react-i18next';
import { Check, Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { EmailLang } from '@/lib/emailDocument';
import type { EmailTranslationStatus } from '@/lib/emailTranslations';
import { cn } from '@/lib/utils';

/** Tabs for each language of an email, with what is left to translate. */
export function EmailLanguageTabs({
  languages,
  mainLang,
  value,
  status,
  onChange,
}: {
  languages: EmailLang[];
  mainLang: EmailLang;
  value: EmailLang;
  status: Partial<Record<EmailLang, EmailTranslationStatus>>;
  onChange: (lang: EmailLang) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2">
      <Languages
        aria-hidden
        className="size-4 text-muted-foreground"
      />
      <div
        role="tablist"
        aria-label={t('emailLanguages')}
        className="inline-flex rounded-md border border-border bg-muted/40 p-0.5"
      >
        {languages.map((lang) => {
          const selected = lang === value;
          const todo = status[lang]?.todo ?? 0;
          const detail =
            lang === mainLang
              ? t('emailLangMain')
              : todo
                ? t('emailLangTodo', { count: todo })
                : t('emailLangDone');
          return (
            <button
              key={lang}
              type="button"
              role="tab"
              aria-selected={selected}
              title={detail}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded px-3 text-sm transition-colors',
                selected
                  ? 'bg-background font-medium text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              onClick={() => onChange(lang)}
            >
              {t(lang === 'fr' ? 'emailLangFr' : 'emailLangEn')}
              {lang === mainLang ? (
                <span className="text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
                  {t('emailLangMain')}
                </span>
              ) : todo ? (
                <span
                  className="min-w-5 rounded-full bg-amber-500/15 px-1.5 text-center text-[11px] font-medium leading-5 text-amber-700 dark:text-amber-300"
                  aria-label={detail}
                >
                  {todo}
                </span>
              ) : (
                <Check
                  aria-label={detail}
                  className="size-3.5 text-emerald-600 dark:text-emerald-400"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Swatch({ tone }: { tone: 'missing' | 'outdated' }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block size-3 rounded-sm border border-dashed',
        tone === 'missing'
          ? 'border-amber-600/80 bg-amber-500/15'
          : 'border-blue-600/80 bg-blue-500/15',
      )}
    />
  );
}

/** What a translation shares with the main language, and what is left to do. */
export function EmailTranslationNotice({
  lang,
  mainLang,
  status,
  onMarkCurrent,
}: {
  lang: EmailLang;
  mainLang: EmailLang;
  status: EmailTranslationStatus;
  onMarkCurrent: () => void;
}) {
  const { t } = useTranslation();
  const main = t(`emailLangInline_${mainLang}`);
  const missing = status.todo - status.outdated.length;
  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
      <p>{t('emailTranslationEditing', { lang: t(`emailLangInline_${lang}`), main })}</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {status.todo === 0 ? (
          <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
            <Check
              aria-hidden
              className="size-3.5"
            />
            {t('emailTranslationDone')}
          </span>
        ) : null}
        {missing ? (
          <span className="inline-flex items-center gap-1.5">
            <Swatch tone="missing" />
            {t('emailTranslationMissing', { count: missing, main })}
          </span>
        ) : null}
        {status.outdated.length ? (
          <span className="inline-flex items-center gap-1.5">
            <Swatch tone="outdated" />
            {t('emailTranslationOutdated', { count: status.outdated.length, main })}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={onMarkCurrent}
            >
              {t('emailTranslationMarkCurrent')}
            </Button>
          </span>
        ) : null}
      </div>
    </div>
  );
}
