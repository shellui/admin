import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  deleteOAuthClient,
  fetchOAuthClients,
  updateOAuthClient,
  type OAuthClientRow,
} from '@/lib/adminOauthClientsApi';

type Props = {
  accessToken: string;
};

export function DashboardOAuthClientsSection({ accessToken }: Props) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<OAuthClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchOAuthClients(accessToken);
      setRows(list);
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : t('oauthClientsLoadError'));
    } finally {
      setLoading(false);
    }
  }, [accessToken, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onToggleActive(row: OAuthClientRow, nextActive: boolean) {
    setBusyId(row.id);
    setError(null);
    try {
      await updateOAuthClient(accessToken, row.id, { is_active: nextActive });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('oauthClientsSaveError'));
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(id: number) {
    setBusyId(id);
    setError(null);
    try {
      await deleteOAuthClient(accessToken, id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('oauthClientsSaveError'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="space-y-4" aria-label={t('oauthClientsSectionLabel')}>
      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2 text-lg">
            <KeyRound className="size-4 text-muted-foreground" aria-hidden />
            {t('oauthClientsTitle')}
          </CardTitle>
          <CardDescription className="font-mono text-xs">{t('oauthClientsDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 font-mono text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {t('oauthClientsLoading')}
            </div>
          ) : null}

          {!loading && error ? <Text className="font-mono text-sm text-destructive">{error}</Text> : null}

          {!loading ? (
            <Text className="font-mono text-xs text-muted-foreground">
              {t('oauthClientsAddHint')}
            </Text>
          ) : null}

          {!loading && rows.length > 0 ? (
            <div className="overflow-x-auto rounded-md border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-mono text-[10px] uppercase">{t('oauthClientsColProvider')}</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase">{t('oauthClientsColLabel')}</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase">{t('oauthClientsColClientId')}</TableHead>
                    <TableHead className="w-[100px] font-mono text-[10px] uppercase">{t('oauthClientsColActive')}</TableHead>
                    <TableHead className="w-[72px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">{row.provider}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{row.label}</TableCell>
                      <TableCell className="max-w-[260px] font-mono text-xs break-all">{row.client_id}</TableCell>
                      <TableCell>
                        <input
                          type="checkbox"
                          className="size-4 accent-primary"
                          checked={row.is_active}
                          disabled={busyId === row.id}
                          onChange={(e) => void onToggleActive(row, e.target.checked)}
                          aria-label={t('oauthClientsToggleActive')}
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
                          aria-label={t('oauthClientsDelete')}
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
            <Text className="font-mono text-sm text-muted-foreground">{t('oauthClientsEmpty')}</Text>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
