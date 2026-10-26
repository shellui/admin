import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/admin/PageHeader';
import { StatusBadge, type StatusTone } from '@/components/admin/StatusBadge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { getIsCompanyOwnerFromJwt } from '@/lib/jwtCompany';
import { ActionsSubNav } from '@/features/actions/components/ActionsSubNav';
import {
  ApiUnavailableNotice,
  isApiUnavailableError,
} from '@/features/actions/components/ApiUnavailableNotice';
import { useActionsApi } from '@/features/actions/useActionsApi';
import { WebhookServiceUnavailable } from '@/features/actions/components/WebhookServiceUnavailable';
import { useWebhookPageMeta } from '@/features/actions/useWebhookPageMeta';
import type { ActionDeliveryDetail } from '@/features/actions/types';
import { webhookDeliveriesPath, webhookRuleEditPath } from '@/lib/webhookRoutePaths';
import {
  ActionFeedback,
  feedbackFromThrown,
  type ActionFeedbackState,
} from '@/features/email/components/ActionFeedback';

function statusTone(status: string): StatusTone {
  const s = status.toLowerCase();
  if (s === 'success') return 'success';
  if (s === 'pending' || s === 'processing') return 'info';
  if (s === 'failed' || s === 'dead') return 'destructive';
  return 'muted';
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export function ActionsDeliveryDetailPage() {
  const { t, i18n } = useTranslation();
  const { deliveryId } = useParams();
  const id = deliveryId?.trim() ?? '';
  const accessToken = useShelluiAccessToken();
  const isOwner = Boolean(accessToken && getIsCompanyOwnerFromJwt(accessToken));
  const { service, serviceConfigured } = useWebhookPageMeta();
  const { api } = useActionsApi(accessToken, service.key);

  const [detail, setDetail] = useState<ActionDeliveryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [requeueBusy, setRequeueBusy] = useState(false);
  const [requeueFeedback, setRequeueFeedback] = useState<ActionFeedbackState | null>(null);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!api || !isOwner || !id) {
        setDetail(null);
        setLoading(false);
        return;
      }
      if (!opts?.silent) {
        setLoading(true);
        setError(null);
      }
      try {
        setDetail(await api.fetchDelivery(id));
        if (opts?.silent) setError(null);
      } catch (e) {
        if (!opts?.silent) setDetail(null);
        setError(e);
      } finally {
        setLoading(false);
      }
    },
    [api, id, isOwner],
  );

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
    setRequeueFeedback(null);
    try {
      await api.requeueDelivery(id);
      setRequeueFeedback({ tone: 'success', text: t('actionsRequeued') });
      await load({ silent: true });
    } catch (e) {
      setRequeueFeedback(feedbackFromThrown(e, t('actionsLoadError')));
    } finally {
      setRequeueBusy(false);
    }
  }

  return (
    <div className="w-full space-y-6">
      <PageHeader
        back={{ to: webhookDeliveriesPath(service.key), label: t('actionsBackToDeliveries') }}
        title={t('actionsDeliveryDetailTitle', { id: id || '-' })}
        service={t(service.badgeKey)}
        description={t('actionsDeliveryDetailDescription')}
        actions={
          detail ? (
            <div className="flex flex-col items-end gap-2">
              <Button
                type="button"
                size="sm"
                disabled={requeueBusy}
                onClick={() => void onRequeue()}
              >
                {requeueBusy ? t('actionsRequeueLoading') : t('actionsRequeue')}
              </Button>
              <ActionFeedback feedback={requeueFeedback} />
            </div>
          ) : undefined
        }
      />

      <ActionsSubNav />

      {!serviceConfigured ? <WebhookServiceUnavailable serviceKey={service.key} /> : null}

      {!accessToken && (
        <Alert variant="info">
          <AlertDescription>{t('dashboardNoSession')}</AlertDescription>
        </Alert>
      )}
      {accessToken && !isOwner && (
        <Alert variant="warning">
          <AlertDescription>{t('actionsPageForbidden')}</AlertDescription>
        </Alert>
      )}

      {error && isApiUnavailableError(error) ? (
        <ApiUnavailableNotice
          error={error}
          t={t}
        />
      ) : null}
      {error && !isApiUnavailableError(error) ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{error instanceof Error ? error.message : t('actionsLoadError')}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void load()}
            >
              {t('usersRetry')}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <div
          className="space-y-4"
          aria-busy="true"
          aria-label={t('actionsLoading')}
        >
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      ) : null}

      {detail ? (
        <div className="space-y-6">
          <Card className="rounded-xl shadow-sm">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-sm font-semibold">
                {t('actionsDeliverySummaryTitle')}
              </CardTitle>
              <CardDescription className="text-xs">
                {t('actionsDeliverySummaryDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <dl className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                <Field label={t('actionsColStatus')}>
                  <StatusBadge tone={statusTone(detail.status)}>{detail.status}</StatusBadge>
                </Field>
                <Field label={t('actionsColEvent')}>
                  <span className="font-mono text-xs">{detail.event}</span>
                </Field>
                <Field label={t('actionsColRule')}>
                  {detail.rule_id != null && detail.rule_id !== '' ? (
                    <Link
                      to={webhookRuleEditPath(service.key, detail.rule_id)}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {detail.rule_name || detail.rule_id}
                    </Link>
                  ) : (
                    detail.rule_name || '-'
                  )}
                </Field>
                <Field label={t('actionsColAttempts')}>
                  <span className="tabular-nums">{detail.attempts_count}</span>
                </Field>
                <Field label={t('actionsColCreated')}>{formatDate(detail.created_at)}</Field>
                <Field label={t('actionsColUpdated')}>{formatDate(detail.updated_at)}</Field>
              </dl>
              {detail.last_error ? (
                <div className="mt-4 space-y-1">
                  <p className="text-xs text-muted-foreground">{t('actionsColLastError')}</p>
                  <pre className="overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 font-mono text-xs text-destructive">
                    {detail.last_error}
                  </pre>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="rounded-xl shadow-sm">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-sm font-semibold">{t('actionsAttemptsTitle')}</CardTitle>
              <CardDescription className="text-xs">
                {t('actionsAttemptsDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {detail.attempts.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('actionsAttemptsEmpty')}</p>
              ) : (
                <ol className="relative space-y-4 border-l border-border pl-5">
                  {detail.attempts.map((attempt) => (
                    <li
                      key={attempt.id}
                      className="relative space-y-1"
                    >
                      <span
                        className="absolute -left-[1.6rem] top-1.5 size-2.5 rounded-full border-2 border-background bg-border"
                        aria-hidden
                      />
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <StatusBadge tone={statusTone(attempt.status)}>
                          {attempt.status}
                        </StatusBadge>
                        {attempt.response_status != null ? (
                          <span className="font-mono text-muted-foreground">
                            HTTP {attempt.response_status}
                          </span>
                        ) : null}
                        {attempt.trigger ? (
                          <span className="text-muted-foreground">
                            {t(`actionsAttemptTrigger_${attempt.trigger}`, {
                              defaultValue: attempt.trigger,
                            })}
                          </span>
                        ) : null}
                        {attempt.scheduled_job_run_id != null ? (
                          <span className="text-muted-foreground">
                            {t('actionsAttemptScheduledRun', { id: attempt.scheduled_job_run_id })}
                          </span>
                        ) : null}
                        <span className="text-muted-foreground">
                          {formatDate(attempt.created_at)}
                        </span>
                      </div>
                      {attempt.error ? (
                        <p className="font-mono text-xs text-destructive">{attempt.error}</p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          {detail.payload != null ? (
            <Card className="rounded-xl shadow-sm">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-sm font-semibold">{t('actionsPayloadTitle')}</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <pre className="max-h-80 overflow-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-xs">
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
