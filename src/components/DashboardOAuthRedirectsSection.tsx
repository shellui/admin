import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link2, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  createLoginRedirect,
  deleteLoginRedirect,
  fetchLoginRedirects,
  updateLoginRedirect,
  type LoginRedirectRow,
} from '@/lib/adminLoginRedirectsApi';

type Props = {
  accessToken: string;
};

export function DashboardOAuthRedirectsSection({ accessToken }: Props) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<LoginRedirectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState('');
  const [label, setLabel] = useState('');
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchLoginRedirects(accessToken);
      setRows(list);
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : t('loginRedirectsLoadError'));
    } finally {
      setLoading(false);
    }
  }, [accessToken, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    const u = baseUrl.trim();
    if (!u) return;
    setAdding(true);
    setError(null);
    try {
      await createLoginRedirect(accessToken, {
        base_url: u,
        label: label.trim() || undefined,
      });
      setBaseUrl('');
      setLabel('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('loginRedirectsSaveError'));
    } finally {
      setAdding(false);
    }
  }

  async function onToggleActive(row: LoginRedirectRow, nextActive: boolean) {
    setBusyId(row.id);
    setError(null);
    try {
      await updateLoginRedirect(accessToken, row.id, { is_active: nextActive });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('loginRedirectsSaveError'));
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(id: number) {
    setBusyId(id);
    setError(null);
    try {
      await deleteLoginRedirect(accessToken, id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('loginRedirectsSaveError'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="space-y-4" aria-label={t('loginRedirectsSectionLabel')}>
      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2 text-lg">
            <Link2 className="size-4 text-muted-foreground" aria-hidden />
            {t('loginRedirectsTitle')}
          </CardTitle>
          <CardDescription className="font-mono text-xs">{t('loginRedirectsDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 font-mono text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {t('loginRedirectsLoading')}
            </div>
          ) : null}

          {!loading && error ? <Text className="font-mono text-sm text-destructive">{error}</Text> : null}

          {!loading ? (
            <form onSubmit={(ev) => void onAdd(ev)} className="space-y-3 rounded-md border border-border/60 p-3">
              <p className="font-mono text-[10px] text-muted-foreground">{t('loginRedirectsAddHint')}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <label
                    htmlFor="login-redirect-base"
                    className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground"
                  >
                    {t('loginRedirectsBaseUrlLabel')}
                  </label>
                  <Input
                    id="login-redirect-base"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    className="font-mono text-sm"
                    placeholder="https://app.example.com/login/callback"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label
                    htmlFor="login-redirect-label"
                    className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground"
                  >
                    {t('loginRedirectsLabelField')}
                  </label>
                  <Input
                    id="login-redirect-label"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    className="font-mono text-sm"
                    placeholder={t('loginRedirectsLabelPlaceholder')}
                    autoComplete="off"
                  />
                </div>
              </div>
              <Button type="submit" size="sm" disabled={adding || !baseUrl.trim()}>
                {adding ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    {t('loginRedirectsAdding')}
                  </>
                ) : (
                  t('loginRedirectsAdd')
                )}
              </Button>
            </form>
          ) : null}

          {!loading && rows.length > 0 ? (
            <div className="overflow-x-auto rounded-md border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-mono text-[10px] uppercase">{t('loginRedirectsColUrl')}</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase">{t('loginRedirectsColLabel')}</TableHead>
                    <TableHead className="w-[100px] font-mono text-[10px] uppercase">
                      {t('loginRedirectsColActive')}
                    </TableHead>
                    <TableHead className="w-[72px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="max-w-[280px] font-mono text-xs break-all">{row.base_url}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{row.label || '—'}</TableCell>
                      <TableCell>
                        <input
                          type="checkbox"
                          className="size-4 accent-primary"
                          checked={row.is_active}
                          disabled={busyId === row.id}
                          onChange={(e) => {
                            void onToggleActive(row, e.target.checked);
                          }}
                          aria-label={t('loginRedirectsToggleActive')}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:text-destructive"
                          disabled={busyId === row.id}
                          onClick={() => void onDelete(row.id)}
                          aria-label={t('loginRedirectsDelete')}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}

          {!loading && rows.length === 0 ? (
            <Text className="font-mono text-sm text-muted-foreground">{t('loginRedirectsEmpty')}</Text>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
