import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Loader2, Trash2, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useLang } from '@/contexts/LangContext';
import {
  ActionFeedback,
  feedbackFromError,
  type ActionFeedbackState,
} from '@/features/email/components/ActionFeedback';
import { SearchField } from '@/features/email/components/SearchField';
import { SegmentedControl } from '@/features/email/components/SegmentedControl';
import { confirmAction } from '@/lib/confirmAction';
import type { EmailApiClient } from '@/lib/emailApi';
import { emailErrorText } from '@/lib/emailApiErrors';
import {
  NEWSLETTER_STATUSES,
  type Newsletter,
  type NewsletterSubscriberPage,
  type NewsletterSubscriberStatus,
} from '@/lib/emailNewsletters';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function formatDate(value: string | null, lang: string): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(lang, { dateStyle: 'medium' });
}

function download(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function NewsletterStatusBadge({ status }: { status: NewsletterSubscriberStatus }) {
  const { t } = useTranslation();
  const variant = status === 'confirmed' ? 'default' : status === 'pending' ? 'outline' : 'muted';
  return <Badge variant={variant}>{t(`emailNewsletterStatus_${status}`)}</Badge>;
}

/** Who is on the list: browse, add, import, export, and remove. */
export function NewsletterSubscribersPanel({
  api,
  newsletter,
  onChanged,
}: {
  api: EmailApiClient;
  newsletter: Newsletter;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const lang = useLang();
  const [status, setStatus] = useState<NewsletterSubscriberStatus | ''>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<NewsletterSubscriberPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [email, setEmail] = useState('');
  const [consented, setConsented] = useState(false);
  const [importConsented, setImportConsented] = useState(false);
  const [busy, setBusy] = useState<'add' | 'import' | 'export' | null>(null);
  const [addFeedback, setAddFeedback] = useState<ActionFeedbackState | null>(null);
  const [importFeedback, setImportFeedback] = useState<ActionFeedbackState | null>(null);
  const [listFeedback, setListFeedback] = useState<ActionFeedbackState | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const query = search.trim();
  const exact = EMAIL_RE.test(query) ? query : '';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.fetchSubscribers(newsletter.id, { status, email: exact, page }));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [api, newsletter.id, status, exact, page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function refresh() {
    await load();
    onChanged();
  }

  async function add(ev: FormEvent) {
    ev.preventDefault();
    if (busy) return;
    setBusy('add');
    setAddFeedback(null);
    try {
      const result = await api.addSubscriber(newsletter.id, {
        email: email.trim(),
        mode: consented ? 'consented' : 'confirm',
      });
      setAddFeedback({ tone: 'success', text: t(`emailNewsletterAdded_${result.outcome}`) });
      setEmail('');
      await refresh();
    } catch (err) {
      setAddFeedback(feedbackFromError(t, err));
    } finally {
      setBusy(null);
    }
  }

  async function importFile(file: File) {
    if (busy) return;
    setBusy('import');
    setImportFeedback(null);
    try {
      const result = await api.importSubscribers(newsletter.id, {
        csv: await file.text(),
        mode: importConsented ? 'consented' : 'confirm',
      });
      setImportFeedback({ tone: 'success', text: t('emailNewsletterImported', result) });
      await refresh();
    } catch (err) {
      setImportFeedback(feedbackFromError(t, err));
    } finally {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function exportCsv() {
    if (busy) return;
    setBusy('export');
    setListFeedback(null);
    try {
      download(
        await api.exportSubscribers(newsletter.id, status),
        `newsletter-${newsletter.id}-subscribers.csv`,
      );
    } catch (err) {
      setListFeedback(feedbackFromError(t, err));
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: number, label: string) {
    const ok = await confirmAction({
      title: t('emailNewsletterRemoveTitle'),
      description: t('emailNewsletterRemoveDescription', { email: label }),
      okLabel: t('emailNewsletterRemove'),
      cancelLabel: t('actionsCancel'),
      danger: true,
    });
    if (!ok) return;
    setListFeedback(null);
    try {
      await api.deleteSubscriber(newsletter.id, id);
      await refresh();
    } catch (err) {
      setListFeedback(feedbackFromError(t, err));
    }
  }

  const statusOptions: Array<{ value: NewsletterSubscriberStatus | ''; label: string }> = [
    { value: '', label: t('emailNewsletterStatusAll') },
    ...NEWSLETTER_STATUSES.map((value) => ({
      value,
      label: `${t(`emailNewsletterStatus_${value}`)} ${newsletter.counts[value]}`,
    })),
  ];
  const pages = data ? Math.max(1, Math.ceil(data.count / data.pageSize)) : 1;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl
            label={t('emailNewsletterStatusFilter')}
            value={status}
            options={statusOptions}
            onChange={(next) => {
              setStatus(next);
              setPage(1);
            }}
          />
          <div className="w-64">
            <SearchField
              value={search}
              onChange={(next) => {
                setSearch(next);
                setPage(1);
              }}
              placeholder={t('emailNewsletterSearch')}
              label={t('emailNewsletterSearch')}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={busy !== null}
            onClick={() => void exportCsv()}
          >
            {busy === 'export' ? <Loader2 className="animate-spin" /> : <Download />}
            {t('emailNewsletterExport')}
          </Button>
        </div>
        {query && !exact ? <Text className="text-xs">{t('emailNewsletterSearchHint')}</Text> : null}
        <ActionFeedback feedback={listFeedback} />
        {error ? (
          <Text className="font-mono text-sm text-destructive">{emailErrorText(t, error)}</Text>
        ) : null}
        {loading && !data ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t('emailLoading')}
          </div>
        ) : null}
        {data && data.results.length === 0 ? (
          <Text>{t('emailNewsletterNoSubscribers')}</Text>
        ) : null}
        {data && data.results.length ? (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">{t('emailNewsletterColEmail')}</th>
                  <th className="px-3 py-2 font-medium">{t('emailNewsletterColStatus')}</th>
                  <th className="px-3 py-2 font-medium">{t('emailNewsletterColLanguage')}</th>
                  <th className="px-3 py-2 font-medium">{t('emailNewsletterColSource')}</th>
                  <th className="px-3 py-2 font-medium">{t('emailNewsletterColDate')}</th>
                  <th className="px-3 py-2">
                    <span className="sr-only">{t('emailNewsletterRemove')}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.results.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2">
                      <span className="font-mono text-xs">{row.email}</span>
                      {row.firstName ? (
                        <span className="ml-2 text-xs text-muted-foreground">{row.firstName}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <NewsletterStatusBadge status={row.status} />
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {t(`emailLangInline_${row.language}`, { defaultValue: row.language })}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {t(`emailNewsletterSource_${row.source}`)}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {formatDate(row.unsubscribedAt ?? row.confirmedAt ?? row.createdAt, lang)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-label={t('emailNewsletterRemoveOne', { email: row.email })}
                        onClick={() => void remove(row.id, row.email)}
                      >
                        <Trash2 />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {data && pages > 1 ? (
          <div className="flex items-center gap-3 text-sm">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => current - 1)}
            >
              {t('emailNewsletterPrevious')}
            </Button>
            <span className="text-xs text-muted-foreground">
              {t('emailNewsletterPage', { page, pages })}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page >= pages || loading}
              onClick={() => setPage((current) => current + 1)}
            >
              {t('emailNewsletterNext')}
            </Button>
          </div>
        ) : null}
      </section>

      <aside className="space-y-4">
        <form
          className="space-y-3 rounded-lg border border-border bg-card p-4"
          onSubmit={(ev) => void add(ev)}
        >
          <h2 className="text-sm font-semibold">{t('emailNewsletterAddTitle')}</h2>
          <div className="space-y-1.5">
            <Label htmlFor="newsletter-add-email">{t('emailNewsletterColEmail')}</Label>
            <Input
              id="newsletter-add-email"
              type="email"
              required
              value={email}
              placeholder="ada@example.com"
              onChange={(ev) => setEmail(ev.target.value)}
            />
          </div>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 rounded border"
              checked={consented}
              onChange={(ev) => setConsented(ev.target.checked)}
            />
            <span>{t('emailNewsletterConsented')}</span>
          </label>
          <Text className="text-xs">
            {consented ? t('emailNewsletterConsentedHint') : t('emailNewsletterConfirmHint')}
          </Text>
          <Button
            type="submit"
            disabled={busy !== null || !email.trim()}
          >
            {busy === 'add' ? <Loader2 className="animate-spin" /> : null}
            {t('emailNewsletterAdd')}
          </Button>
          <ActionFeedback feedback={addFeedback} />
        </form>

        <section className="space-y-3 rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">{t('emailNewsletterImportTitle')}</h2>
          <Text className="text-xs">{t('emailNewsletterImportHint')}</Text>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 rounded border"
              checked={importConsented}
              onChange={(ev) => setImportConsented(ev.target.checked)}
            />
            <span>{t('emailNewsletterConsentedAll')}</span>
          </label>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            aria-label={t('emailNewsletterImportFile')}
            onChange={(ev) => {
              const file = ev.target.files?.[0];
              if (file) void importFile(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={busy !== null}
            onClick={() => fileInput.current?.click()}
          >
            {busy === 'import' ? <Loader2 className="animate-spin" /> : <Upload />}
            {t('emailNewsletterImportFile')}
          </Button>
          <ActionFeedback feedback={importFeedback} />
        </section>
      </aside>
    </div>
  );
}
