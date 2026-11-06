import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { askShelluiConfirm } from '@/lib/shelluiConfirm';
import {
  createOAuthRedirect,
  deleteOAuthRedirect,
  fetchOAuthRedirects,
  type OAuthRedirectRow,
} from '@/lib/adminOauthRedirectsApi';

type Props = {
  accessToken: string;
};

export function OAuthRedirectsSection({ accessToken }: Props) {
  const { t } = useTranslation();
  const [redirectRows, setRedirectRows] = useState<OAuthRedirectRow[]>([]);
  const [redirectsLoading, setRedirectsLoading] = useState(false);
  const [redirectError, setRedirectError] = useState<string | null>(null);
  const [newRedirectUrl, setNewRedirectUrl] = useState('');
  const [newRedirectLabel, setNewRedirectLabel] = useState('');
  const [redirectBusy, setRedirectBusy] = useState(false);

  const loadRedirects = useCallback(async () => {
    if (!accessToken) {
      setRedirectRows([]);
      setRedirectError(null);
      setRedirectsLoading(false);
      return;
    }
    setRedirectsLoading(true);
    setRedirectError(null);
    try {
      setRedirectRows(await fetchOAuthRedirects(accessToken));
    } catch (e) {
      setRedirectRows([]);
      setRedirectError(e instanceof Error ? e.message : t('loginRedirectsLoadError'));
    } finally {
      setRedirectsLoading(false);
    }
  }, [accessToken, t]);

  useEffect(() => {
    void loadRedirects();
  }, [loadRedirects]);

  const manualRedirectRows = useMemo(
    () => redirectRows.filter((row) => (row.source || 'manual') !== 'hosting'),
    [redirectRows],
  );
  const hostingRedirectRows = useMemo(
    () => redirectRows.filter((row) => row.source === 'hosting'),
    [redirectRows],
  );

  async function onAddRedirect() {
    if (!accessToken || !newRedirectUrl.trim()) return;
    setRedirectBusy(true);
    setRedirectError(null);
    try {
      await createOAuthRedirect(accessToken, {
        base_url: newRedirectUrl.trim(),
        label: newRedirectLabel.trim() || undefined,
      });
      setNewRedirectUrl('');
      setNewRedirectLabel('');
      await loadRedirects();
    } catch (e) {
      setRedirectError(e instanceof Error ? e.message : t('loginRedirectsSaveError'));
    } finally {
      setRedirectBusy(false);
    }
  }

  async function onDeleteRedirect(row: OAuthRedirectRow) {
    if (!accessToken) return;
    const confirmed = await askShelluiConfirm({
      title: t('loginRedirectsDeleteConfirmTitle'),
      description: t('loginRedirectsDeleteConfirmDescription', { url: row.base_url }),
      okLabel: t('loginRedirectsDelete'),
      cancelLabel: t('groupsCancelEdit'),
      mode: 'delete',
    });
    if (!confirmed) return;
    setRedirectBusy(true);
    setRedirectError(null);
    try {
      await deleteOAuthRedirect(accessToken, row.id);
      await loadRedirects();
    } catch (e) {
      setRedirectError(e instanceof Error ? e.message : t('loginRedirectsSaveError'));
    } finally {
      setRedirectBusy(false);
    }
  }

  const card = 'overflow-hidden rounded-xl border border-border bg-card shadow-xs';
  const loadingRows = (
    <div className="space-y-2 p-4">
      <span className="sr-only">{t('loginRedirectsLoading')}</span>
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
    </div>
  );
  return (
    <>
      <section className={card}>
        <div className="space-y-1 border-b border-border px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold">{t('loginRedirectsTitle')}</h2>
          <p className="text-xs text-muted-foreground">{t('loginRedirectsDescription')}</p>
        </div>
        {redirectError ? (
          <div className="p-4">
            <Alert variant="destructive">
              <AlertDescription>{redirectError}</AlertDescription>
            </Alert>
          </div>
        ) : null}
        {redirectsLoading ? loadingRows : null}
        {!redirectsLoading && manualRedirectRows.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground sm:px-5">
            {t('loginRedirectsEmpty')}
          </p>
        ) : null}
        {!redirectsLoading && manualRedirectRows.length > 0 ? (
          <ul className="divide-y divide-border">
            {manualRedirectRows.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate font-mono text-xs">{row.base_url}</p>
                    {row.label ? (
                      <p className="text-xs text-muted-foreground">{row.label}</p>
                    ) : null}
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  disabled={redirectBusy}
                  onClick={() => void onDeleteRedirect(row)}
                >
                  {t('loginRedirectsDelete')}
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="space-y-2 border-t border-border bg-muted/30 px-4 py-3 sm:px-5">
          <p className="text-xs text-muted-foreground">{t('loginRedirectsAddHint')}</p>
          <div className="grid gap-2 sm:grid-cols-[2fr_1fr_auto]">
            <Input
              value={newRedirectUrl}
              onChange={(e) => setNewRedirectUrl(e.target.value)}
              placeholder="https://app.example.com"
              className="font-mono text-xs"
              aria-label={t('loginRedirectsBaseUrlLabel')}
            />
            <Input
              value={newRedirectLabel}
              onChange={(e) => setNewRedirectLabel(e.target.value)}
              placeholder={t('loginRedirectsLabelPlaceholder')}
              aria-label={t('loginRedirectsLabelField')}
            />
            <Button
              type="button"
              disabled={redirectBusy || !newRedirectUrl.trim()}
              onClick={() => void onAddRedirect()}
            >
              {redirectBusy ? t('loginRedirectsAdding') : t('loginRedirectsAdd')}
            </Button>
          </div>
        </div>
      </section>

      <section className={card}>
        <div className="space-y-1 border-b border-border px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold">{t('loginRedirectsHostingTitle')}</h2>
          <p className="text-xs text-muted-foreground">{t('loginRedirectsHostingDescription')}</p>
        </div>
        {redirectsLoading ? loadingRows : null}
        {!redirectsLoading && hostingRedirectRows.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground sm:px-5">
            {t('loginRedirectsHostingEmpty')}
          </p>
        ) : null}
        {!redirectsLoading && hostingRedirectRows.length > 0 ? (
          <ul className="divide-y divide-border">
            {hostingRedirectRows.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Lock
                    aria-hidden
                    className="size-3.5 shrink-0 text-muted-foreground"
                  />
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate font-mono text-xs">{row.base_url}</p>
                    {row.label ? (
                      <p className="text-xs text-muted-foreground">{row.label}</p>
                    ) : null}
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  disabled={redirectBusy}
                  onClick={() => void onDeleteRedirect(row)}
                >
                  {t('loginRedirectsDelete')}
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </>
  );
}
