import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { getIsCompanyOwnerFromJwt } from '@/lib/jwtCompany';
import { cn } from '@/lib/utils';
import { ActionsSubNav } from '@/features/actions/components/ActionsSubNav';
import {
  ApiUnavailableNotice,
  isApiUnavailableError,
} from '@/features/actions/components/ApiUnavailableNotice';
import { useActionsApi } from '@/features/actions/useActionsApi';
import type { ActionDeliveryDetail } from '@/features/actions/types';

function statusClassName(status: string) {
  const s = status.toLowerCase();
  if (s === 'success') return 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200';
  if (s === 'pending' || s === 'processing') return 'bg-sky-500/15 text-sky-900 dark:text-sky-100';
  if (s === 'failed' || s === 'dead') return 'bg-destructive/15 text-destructive';
  return 'bg-muted text-muted-foreground';
}

export function ActionsDeliveryDetailPage() {
  const { t, i18n } = useTranslation();
  const { deliveryId } = useParams();
  const id = deliveryId?.trim() ?? '';
  const accessToken = useShelluiAccessToken();
  const isOwner = Boolean(accessToken && getIsCompanyOwnerFromJwt(accessToken));
  const { api } = useActionsApi(accessToken);

  const [detail, setDetail] = useState<ActionDeliveryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [requeueBusy, setRequeueBusy] = useState(false);

  const load = useCallback(async () => {
    if (!api || !isOwner || !id) {
      setDetail(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setDetail(await api.fetchDelivery(id));
    } catch (e) {
      setDetail(null);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [api, id, isOwner]);

  useEffect(() => {
    void load();
  }, [load]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat(i18n.language || 'en', {
      dateStyle: 'medium',
      timeStyle: 'medium',
    }).format(d);
  };

  async function onRequeue() {
    if (!api || !id) return;
    setRequeueBusy(true);
    setError(null);
    try {
      await api.requeueDelivery(id);
      await load();
    } catch (e) {
      setError(e);
    } finally {
      setRequeueBusy(false);
    }
  }

  return (
    <div className="w-full space-y-6">
      <header className="space-y-1">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
            {t('actionsDeliveryDetailTitle', { id: id || '—' })}
          </h1>
          <Badge
            variant="secondary"
            className="font-mono text-[10px] uppercase"
          >
            {t('actionsBadge')}
          </Badge>
        </div>
        <Text className="max-w-3xl text-sm text-muted-foreground">
          {t('actionsDeliveryDetailDescription')}
        </Text>
      </header>

      <ActionsSubNav />

      <Button
        type="button"
        size="sm"
        variant="outline"
        asChild
      >
        <Link to="/actions/deliveries">{t('actionsBackToDeliveries')}</Link>
      </Button>

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

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-muted-foreground">
          <Loader2
            className="size-5 animate-spin"
            aria-hidden
          />
          <span className="text-sm">{t('actionsLoading')}</span>
        </div>
      ) : null}

      {detail ? (
        <div className="space-y-6">
          <Card className="border-border/80 shadow-sm">
            <CardHeader>
              <CardTitle className="font-heading text-lg">
                {t('actionsDeliverySummaryTitle')}
              </CardTitle>
              <CardDescription className="font-mono text-xs">
                {t('actionsDeliverySummaryDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 font-mono text-xs sm:grid-cols-2">
              <p>
                {t('actionsColStatus')}:{' '}
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 font-medium',
                    statusClassName(detail.status),
                  )}
                >
                  {detail.status}
                </span>
              </p>
              <p>
                {t('actionsColEvent')}: {detail.event}
              </p>
              <p>
                {t('actionsColRule')}: {detail.rule_name || detail.rule_id}
              </p>
              <p>
                {t('actionsColAttempts')}: {detail.attempts_count}
              </p>
              <p>
                {t('actionsColCreated')}: {formatDate(detail.created_at)}
              </p>
              <p>
                {t('actionsColUpdated')}: {formatDate(detail.updated_at)}
              </p>
              {detail.last_error ? (
                <p className="sm:col-span-2 text-destructive">
                  {t('actionsColLastError')}: {detail.last_error}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={requeueBusy}
              onClick={() => void onRequeue()}
            >
              {requeueBusy ? t('actionsRequeueLoading') : t('actionsRequeue')}
            </Button>
          </div>

          <Card className="border-border/80 shadow-sm">
            <CardHeader>
              <CardTitle className="font-heading text-lg">{t('actionsAttemptsTitle')}</CardTitle>
              <CardDescription className="font-mono text-xs">
                {t('actionsAttemptsDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {detail.attempts.length === 0 ? (
                <Text className="font-mono text-sm text-muted-foreground">
                  {t('actionsAttemptsEmpty')}
                </Text>
              ) : (
                <ol className="relative space-y-4 border-l border-border pl-4">
                  {detail.attempts.map((attempt) => (
                    <li
                      key={attempt.id}
                      className="space-y-1"
                    >
                      <p className="font-mono text-xs text-muted-foreground">
                        {formatDate(attempt.created_at)}
                      </p>
                      <p className="font-mono text-xs">
                        <span
                          className={cn('rounded px-1.5 py-0.5', statusClassName(attempt.status))}
                        >
                          {attempt.status}
                        </span>
                        {attempt.response_status != null ? (
                          <span className="ml-2 text-muted-foreground">
                            HTTP {attempt.response_status}
                          </span>
                        ) : null}
                      </p>
                      {attempt.error ? (
                        <p className="font-mono text-[11px] text-destructive">{attempt.error}</p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          {detail.payload != null ? (
            <Card className="border-border/80 shadow-sm">
              <CardHeader>
                <CardTitle className="font-heading text-lg">{t('actionsPayloadTitle')}</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="max-h-80 overflow-auto rounded-md bg-muted/40 p-3 font-mono text-[11px]">
                  {JSON.stringify(detail.payload, null, 2)}
                </pre>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
