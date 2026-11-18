import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Pencil, Plus, Trash2, UsersRound } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { DataTableCard, SkeletonRows } from '@/components/admin/DataTableCard';
import { EmptyState } from '@/components/admin/EmptyState';
import { PageHeader } from '@/components/admin/PageHeader';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { askShelluiConfirm } from '@/lib/shelluiConfirm';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
    setEditName(row.display_name);
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

  async function onDelete(row: AdminGroupRow) {
    if (!accessToken) return;
    const id = row.id;
    const confirmed = await askShelluiConfirm({
      title: t('groupsDeleteConfirmTitle', { name: row.display_name }),
      description: t('groupsDeleteConfirmDescription'),
      okLabel: t('groupsDelete'),
      cancelLabel: t('groupsCancelEdit'),
      mode: 'delete',
    });
    if (!confirmed) return;
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

  const cols = ['w-20 hidden sm:table-cell', '', 'w-26', 'w-40'];
  return (
    <div className="w-full space-y-6">
      <PageHeader
        title={t('groupsTitle')}
        service={t('usersSchemaBadge')}
        description={t('groupsDescription')}
      />

      <section className="rounded-xl border border-border bg-card p-4 shadow-xs sm:p-5">
        <div className="mb-3 space-y-1">
          <h2 className="text-sm font-semibold">{t('groupsCreateTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('groupsCreateDescription')}</p>
        </div>
        {!accessToken ? (
          <Alert>
            <AlertDescription>{t('usersNoSession')}</AlertDescription>
          </Alert>
        ) : (
          <form
            onSubmit={(e) => void onCreate(e)}
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
          >
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="new-group-name">{t('groupsFieldName')}</Label>
              <Input
                id="new-group-name"
                value={newName}
                onChange={(ev) => setNewName(ev.target.value)}
                placeholder={t('groupsFieldNamePlaceholder')}
                autoComplete="off"
                disabled={creating}
              />
            </div>
            <Button
              type="submit"
              disabled={creating || !newName.trim()}
            >
              {creating ? (
                <Loader2 className="animate-spin motion-reduce:animate-none" />
              ) : (
                <Plus aria-hidden />
              )}
              {creating ? t('groupsCreating') : t('groupsCreate')}
            </Button>
          </form>
        )}
      </section>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void load()}
            >
              {t('usersRetry')}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {accessToken && !error ? (
        <DataTableCard
          label={t('groupsTableTitle')}
          busy={loading}
          toolbar={
            <div className="space-y-0.5">
              <h2 className="text-sm font-semibold">{t('groupsTableTitle')}</h2>
              <p className="text-xs text-muted-foreground">{t('groupsTableDescription')}</p>
            </div>
          }
        >
          {loading && !rows.length ? <span className="sr-only">{t('groupsLoading')}</span> : null}
          {!loading && rows.length === 0 ? (
            <EmptyState
              icon={UsersRound}
              title={t('groupsEmpty')}
            />
          ) : (
            <Table className="w-full">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={cols[0]}>{t('groupsColId')}</TableHead>
                  <TableHead>{t('groupsColName')}</TableHead>
                  <TableHead className={cols[2]}>{t('groupsColMembers')}</TableHead>
                  <TableHead className={cols[3] + ' text-right'}>{t('groupsColActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && !rows.length ? (
                  <SkeletonRows
                    rows={4}
                    columns={cols}
                  />
                ) : null}
                {rows.map((row) => {
                  const isScim = row.source === 'scim';
                  const editing = editingId === row.id;
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="hidden font-mono text-xs tabular-nums text-muted-foreground sm:table-cell">
                        {row.id}
                      </TableCell>
                      <TableCell>
                        {editing ? (
                          <form
                            className="flex flex-wrap items-center gap-2"
                            onSubmit={(ev) => {
                              ev.preventDefault();
                              void onSaveEdit(row.id);
                            }}
                          >
                            <Input
                              value={editName}
                              aria-label={t('groupsFieldName')}
                              onChange={(ev) => setEditName(ev.target.value)}
                              className="h-8 max-w-xs"
                              autoComplete="off"
                              autoFocus
                              disabled={savingId === row.id}
                            />
                            <Button
                              type="submit"
                              size="sm"
                              disabled={savingId === row.id || !editName.trim()}
                            >
                              {savingId === row.id ? (
                                <Loader2 className="animate-spin motion-reduce:animate-none" />
                              ) : null}
                              {t('groupsSave')}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={savingId === row.id}
                              onClick={() => setEditingId(null)}
                            >
                              {t('groupsCancelEdit')}
                            </Button>
                          </form>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{row.display_name}</span>
                            {isScim ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span tabIndex={0}>
                                    <StatusBadge tone="info">{t('groupsScimBadge')}</StatusBadge>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs text-xs">
                                  {t('groupsScimTooltip')}
                                </TooltipContent>
                              </Tooltip>
                            ) : null}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {typeof row.user_count === 'number' ? row.user_count : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {editing ? null : isScim ? (
                          <span className="whitespace-nowrap text-xs text-muted-foreground">
                            {t('groupsScimActionsNote')}
                          </span>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-8 text-muted-foreground"
                              aria-label={t('groupsRename')}
                              onClick={() => startEdit(row)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-8 text-destructive hover:text-destructive"
                              aria-label={t('groupsDelete')}
                              disabled={deletingId === row.id}
                              onClick={() => void onDelete(row)}
                            >
                              {deletingId === row.id ? (
                                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                              ) : (
                                <Trash2 className="size-4" />
                              )}
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </DataTableCard>
      ) : null}
    </div>
  );
}
