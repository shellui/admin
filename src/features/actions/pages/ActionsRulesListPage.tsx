import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Text } from '@/components/ui/text';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { getIsCompanyOwnerFromJwt } from '@/lib/jwtCompany';
import { ActionsSubNav } from '@/features/actions/components/ActionsSubNav';
import {
  ApiUnavailableNotice,
  isApiUnavailableError,
} from '@/features/actions/components/ApiUnavailableNotice';
import { useActionsApi } from '@/features/actions/useActionsApi';
import type { ActionRule, ActionRuleId } from '@/features/actions/types';

export function ActionsRulesListPage() {
  const { t, i18n } = useTranslation();
  const accessToken = useShelluiAccessToken();
  const isOwner = Boolean(accessToken && getIsCompanyOwnerFromJwt(accessToken));
  const { api } = useActionsApi(accessToken);
  const [rows, setRows] = useState<ActionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [busyId, setBusyId] = useState<ActionRuleId | null>(null);

  const load = useCallback(async () => {
    if (!api || !isOwner) {
      setRows([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setRows(await api.fetchRules());
    } catch (e) {
      setRows([]);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [api, isOwner]);

  useEffect(() => {
    void load();
  }, [load]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat(i18n.language || 'en', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(d);
  };

  async function onToggle(rule: ActionRule) {
    if (!api) return;
    setBusyId(rule.id);
    setError(null);
    try {
      await api.updateRule(rule.id, { enabled: !rule.enabled });
      await load();
    } catch (e) {
      setError(e);
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(rule: ActionRule) {
    if (!api) return;
    if (!window.confirm(t('actionsRuleDeleteConfirm', { name: rule.name }))) return;
    setBusyId(rule.id);
    setError(null);
    try {
      await api.deleteRule(rule.id);
      await load();
    } catch (e) {
      setError(e);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="w-full space-y-6">
      <header className="space-y-1">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
            {t('actionsPageTitle')}
          </h1>
          <Badge
            variant="secondary"
            className="font-mono text-[10px] uppercase"
          >
            {t('actionsBadge')}
          </Badge>
        </div>
        <Text className="max-w-3xl text-sm text-muted-foreground">
          {t('actionsPageDescription')}
        </Text>
      </header>

      <ActionsSubNav />

      {!accessToken && (
        <Text className="font-mono text-sm text-muted-foreground">{t('dashboardNoSession')}</Text>
      )}
      {accessToken && !isOwner && (
        <Text className="font-mono text-sm text-muted-foreground">{t('actionsPageForbidden')}</Text>
      )}

      {error && isApiUnavailableError(error) ? (
        <ApiUnavailableNotice
          error={error}
          t={t}
        />
      ) : null}
      {error && !isApiUnavailableError(error) ? (
        <Text className="font-mono text-sm text-destructive">
          {error instanceof Error ? error.message : t('actionsLoadError')}
        </Text>
      ) : null}

      {accessToken && isOwner && api ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-xs text-muted-foreground">{t('actionsRulesListHint')}</p>
          {isApiUnavailableError(error) ? (
            <Button
              type="button"
              size="sm"
              disabled
            >
              {t('actionsRuleCreate')}
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              asChild
            >
              <Link to="/actions/rules/new">{t('actionsRuleCreate')}</Link>
            </Button>
          )}
        </div>
      ) : null}

      {accessToken && isOwner && api && loading ? (
        <div className="flex items-center gap-2 py-8 text-muted-foreground">
          <Loader2
            className="size-5 animate-spin"
            aria-hidden
          />
          <span className="text-sm">{t('actionsLoading')}</span>
        </div>
      ) : null}

      {!loading &&
      rows.length === 0 &&
      accessToken &&
      isOwner &&
      api &&
      !isApiUnavailableError(error) ? (
        <Text className="py-8 text-center font-mono text-sm text-muted-foreground">
          {t('actionsRulesEmpty')}
        </Text>
      ) : null}

      {rows.length > 0 ? (
        <div className="rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-xs uppercase">{t('actionsColName')}</TableHead>
                <TableHead className="text-xs uppercase">{t('actionsColEvent')}</TableHead>
                <TableHead className="text-xs uppercase">{t('actionsColEnabled')}</TableHead>
                <TableHead className="text-xs uppercase">{t('actionsColUpdated')}</TableHead>
                <TableHead className="text-right text-xs uppercase">
                  {t('usersColActions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="font-mono text-xs">
              {rows.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell>
                    <Link
                      to={`/actions/rules/${rule.id}`}
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      {rule.name}
                    </Link>
                  </TableCell>
                  <TableCell>{rule.event}</TableCell>
                  <TableCell>
                    <Badge variant={rule.enabled ? 'default' : 'outline'}>
                      {rule.enabled ? t('actionsEnabledYes') : t('actionsEnabledNo')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(rule.updated_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={busyId === rule.id}
                        onClick={() => void onToggle(rule)}
                      >
                        {rule.enabled ? t('actionsDisable') : t('actionsEnable')}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        asChild
                      >
                        <Link to={`/actions/rules/${rule.id}`}>{t('actionsEdit')}</Link>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={busyId === rule.id}
                        onClick={() => void onDelete(rule)}
                      >
                        {t('actionsDelete')}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  );
}
