import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import {
  createAdminGroup,
  deleteAdminGroup,
  fetchAdminGroups,
  renameAdminGroup,
  type AdminGroupRow,
} from '@/lib/adminGroupsApi';
import shellui from '@shellui/sdk';

export function GroupsListPage() {
  const { t } = useTranslation();
  const accessToken = useShelluiAccessToken();
  const [rows, setRows] = useState<AdminGroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      setRows([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await fetchAdminGroups(accessToken);
      setRows(list);
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : t('usersErrorUnknown'));
    } finally {
      setLoading(false);
    }
  }, [accessToken, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken || !newName.trim()) return;
    setCreating(true);
    try {
      await createAdminGroup(accessToken, newName.trim());
      setNewName('');
      shellui.toast({ title: t('groupsCreated'), type: 'success' });
      await load();
    } catch (err) {
      shellui.toast({
        title: t('groupsError'),
        description: err instanceof Error ? err.message : t('usersErrorUnknown'),
        type: 'error',
      });
    } finally {
      setCreating(false);
    }
  }

  function startEdit(row: AdminGroupRow) {
    setEditingId(row.id);
    setEditName(row.name);
  }

  async function onSaveEdit(id: number) {
    if (!accessToken || !editName.trim()) return;
    setSavingId(id);
    try {
      await renameAdminGroup(accessToken, id, editName.trim());
      setEditingId(null);
      shellui.toast({ title: t('groupsRenamed'), type: 'success' });
      await load();
    } catch (err) {
      shellui.toast({
        title: t('groupsError'),
        description: err instanceof Error ? err.message : t('usersErrorUnknown'),
        type: 'error',
      });
    } finally {
      setSavingId(null);
    }
  }

  async function onDelete(id: number) {
    if (!accessToken) return;
    setDeletingId(id);
    try {
      await deleteAdminGroup(accessToken, id);
      shellui.toast({ title: t('groupsDeleted'), type: 'success' });
      await load();
    } catch (err) {
      shellui.toast({
        title: t('groupsError'),
        description: err instanceof Error ? err.message : t('usersErrorUnknown'),
        type: 'error',
      });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="w-full space-y-6">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">{t('groupsTitle')}</h1>
        <Text className="max-w-3xl text-sm text-muted-foreground">{t('groupsDescription')}</Text>
      </header>

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="font-heading text-lg">{t('groupsCreateTitle')}</CardTitle>
          <CardDescription className="text-sm">{t('groupsCreateDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {!accessToken ? (
            <Text className="text-sm text-muted-foreground">{t('usersNoSession')}</Text>
          ) : (
            <form onSubmit={(e) => void onCreate(e)} className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1">
                <label htmlFor="new-group-name" className="text-xs font-medium text-muted-foreground">
                  {t('groupsFieldName')}
                </label>
                <Input
                  id="new-group-name"
                  value={newName}
                  onChange={(ev) => setNewName(ev.target.value)}
                  placeholder={t('groupsFieldNamePlaceholder')}
                  autoComplete="off"
                  disabled={creating}
                />
              </div>
              <Button type="submit" variant="secondary" disabled={creating || !newName.trim()}>
                {creating ? t('groupsCreating') : t('groupsCreate')}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="font-heading text-lg">{t('groupsTableTitle')}</CardTitle>
          <CardDescription className="text-sm">{t('groupsTableDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {accessToken && !error ? (
            <div className="relative rounded-md border border-border">
              {loading ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/65 backdrop-blur-[1px]">
                  <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden />
                  <span className="sr-only">{t('groupsLoading')}</span>
                </div>
              ) : null}
              <div className="w-full overflow-x-auto">
                <Table className="w-full min-w-[480px]">
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="w-[5rem] text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t('groupsColId')}
                      </TableHead>
                      <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t('groupsColName')}
                      </TableHead>
                      <TableHead className="w-[6.5rem] text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t('groupsColMembers')}
                      </TableHead>
                      <TableHead className="w-[8rem] text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t('groupsColActions')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="font-mono text-xs">
                    {loading && !rows.length
                      ? Array.from({ length: 4 }).map((_, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              <Skeleton className="h-4 w-10" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-full max-w-[16rem]" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-8" />
                            </TableCell>
                            <TableCell />
                          </TableRow>
                        ))
                      : null}
                    {!loading && rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-12 text-center text-muted-foreground">
                          {t('groupsEmpty')}
                        </TableCell>
                      </TableRow>
                    ) : null}
                    {rows.map((row) => (
                      <TableRow key={row.id} className="hover:bg-muted/40">
                        <TableCell className="tabular-nums text-muted-foreground">{row.id}</TableCell>
                        <TableCell>
                          {editingId === row.id ? (
                            <Input
                              value={editName}
                              onChange={(ev) => setEditName(ev.target.value)}
                              className="h-8 font-mono text-xs"
                              autoComplete="off"
                              disabled={savingId === row.id}
                            />
                          ) : (
                            <span className="font-medium text-foreground">{row.name}</span>
                          )}
                        </TableCell>
                        <TableCell className="tabular-nums text-muted-foreground" title={t('groupsColMembers')}>
                          {typeof row.user_count === 'number' ? row.user_count : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {editingId === row.id ? (
                            <div className="flex justify-end gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                className="h-7 px-2 text-[11px]"
                                disabled={savingId === row.id || !editName.trim()}
                                onClick={() => void onSaveEdit(row.id)}
                              >
                                {savingId === row.id ? <Loader2 className="size-3 animate-spin" /> : t('groupsSave')}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-[11px]"
                                disabled={savingId === row.id}
                                onClick={() => setEditingId(null)}
                              >
                                {t('groupsCancelEdit')}
                              </Button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-muted-foreground"
                                aria-label={t('groupsRename')}
                                onClick={() => startEdit(row)}
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                aria-label={t('groupsDelete')}
                                disabled={deletingId === row.id}
                                onClick={() => void onDelete(row.id)}
                              >
                                {deletingId === row.id ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="size-3.5" />
                                )}
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
