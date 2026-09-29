import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
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

  return (
    <>
      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="font-heading text-lg">{t('loginRedirectsTitle')}</CardTitle>
          <CardDescription className="font-mono text-xs">
            {t('loginRedirectsDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {redirectError ? (
            <Text className="font-mono text-sm text-destructive">{redirectError}</Text>
          ) : null}
          {redirectsLoading ? (
            <Text className="font-mono text-sm text-muted-foreground">
              {t('loginRedirectsLoading')}
            </Text>
          ) : null}
          {!redirectsLoading && manualRedirectRows.length === 0 ? (
            <Text className="font-mono text-sm text-muted-foreground">
              {t('loginRedirectsEmpty')}
            </Text>
          ) : null}
          {!redirectsLoading && manualRedirectRows.length > 0 ? (
            <ul className="divide-y divide-border rounded-md border border-border">
              {manualRedirectRows.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate font-mono text-xs">{row.base_url}</p>
                    {row.label ? (
                      <p className="font-mono text-[10px] text-muted-foreground">{row.label}</p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={redirectBusy}
                    onClick={() => void onDeleteRedirect(row)}
                  >
                    {t('loginRedirectsDelete')}
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="space-y-2 rounded-md border border-border/70 p-3">
            <p className="font-mono text-[10px] text-muted-foreground">
              {t('loginRedirectsAddHint')}
            </p>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
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
                className="font-mono text-xs sm:col-span-1"
                aria-label={t('loginRedirectsLabelField')}
              />
            </div>
            <Button
              type="button"
              size="sm"
              disabled={redirectBusy || !newRedirectUrl.trim()}
              onClick={() => void onAddRedirect()}
            >
              {redirectBusy ? t('loginRedirectsAdding') : t('loginRedirectsAdd')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="font-heading text-lg">{t('loginRedirectsHostingTitle')}</CardTitle>
          <CardDescription className="font-mono text-xs">
            {t('loginRedirectsHostingDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {redirectsLoading ? (
            <Text className="font-mono text-sm text-muted-foreground">
              {t('loginRedirectsLoading')}
            </Text>
          ) : null}
          {!redirectsLoading && hostingRedirectRows.length === 0 ? (
            <Text className="font-mono text-sm text-muted-foreground">
              {t('loginRedirectsHostingEmpty')}
            </Text>
          ) : null}
          {!redirectsLoading && hostingRedirectRows.length > 0 ? (
            <ul className="divide-y divide-border rounded-md border border-border">
              {hostingRedirectRows.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate font-mono text-xs">{row.base_url}</p>
                    {row.label ? (
                      <p className="font-mono text-[10px] text-muted-foreground">{row.label}</p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={redirectBusy}
                    onClick={() => void onDeleteRedirect(row)}
                  >
                    {t('loginRedirectsDelete')}
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}
