import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ban, Inbox, MailCheck, MailWarning, RefreshCw, Send, Timer, UserX } from 'lucide-react';
import { KpiCard, KpiRow, KpiSkeletonRow, ServiceSectionHeader } from '@/components/admin/Kpi';
import { PageHeader } from '@/components/admin/PageHeader';
import { BarSeriesCard, StatTableCard } from '@/components/admin/StatsParts';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  ActionFeedback,
  feedbackFromError,
  type ActionFeedbackState,
} from '@/features/email/components/ActionFeedback';
import { SearchField } from '@/features/email/components/SearchField';
import { useEmailApi } from '@/features/email/useEmailApi';
import { DashboardScheduledJobsSection } from '@/components/DashboardScheduledJobsSection';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { emailErrorText } from '@/lib/emailApiErrors';
import { filterByQuery, listNeedsSearch, sectionTitle } from '@/lib/emailList';
import { EMAIL_LANES, type EmailMetricsSnapshot } from '@/lib/emailMetrics';
import type { EmailCountBucket, EmailStats } from '@/lib/emailTypes';
import { cn } from '@/lib/utils';

function formatInt(n: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Math.round(n));
}

function formatSeconds(n: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(n);
}

const COUNT_LABELS: Array<{
  key: keyof EmailCountBucket;
  labelKey: string;
  icon: typeof Inbox;
}> = [
  { key: 'sent', labelKey: 'emailStatsSent', icon: Send },
  { key: 'delivered', labelKey: 'emailStatsDelivered', icon: MailCheck },
  { key: 'bounced', labelKey: 'emailStatsBounced', icon: MailWarning },
  { key: 'complained', labelKey: 'emailStatsComplained', icon: MailWarning },
  { key: 'expired', labelKey: 'emailStatsExpired', icon: Timer },
  { key: 'failed', labelKey: 'emailStatsFailed', icon: MailWarning },
];

export function EmailStatisticsPage() {
  const { t } = useTranslation();
  const accessToken = useShelluiAccessToken();
  const { api, baseUrl, canManage } = useEmailApi(accessToken);
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [metrics, setMetrics] = useState<EmailMetricsSnapshot | null>(null);
  const [lane, setLane] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [actionResult, setActionResult] = useState<'ok' | 'error' | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const [eventQuery, setEventQuery] = useState('');
  const refreshFeedback: ActionFeedbackState | null =
    actionResult === 'ok'
      ? { tone: 'success', text: t('emailStatsRefreshed') }
      : actionResult === 'error'
        ? feedbackFromError(t, actionError)
        : null;

  const load = useCallback(
    async (source: 'page' | 'action') => {
      if (!api || !canManage) {
        setLoading(false);
        return;
      }
      setLoading(true);
      if (source === 'page') {
        setError(null);
        setActionResult(null);
      } else {
        setActionResult(null);
      }
      try {
        const [nextStats, nextMetrics] = await Promise.all([
          api.fetchStats(lane ? { lane } : {}),
          api.fetchMetrics(),
        ]);
        setStats(nextStats);
        setMetrics(nextMetrics);
        if (source === 'action') {
          setError(null);
          setActionError(null);
          setActionResult('ok');
        }
      } catch (err) {
        if (source === 'page') {
          setStats(null);
          setMetrics(null);
          setError(err);
        } else {
          setActionError(err);
          setActionResult('error');
        }
      } finally {
        setLoading(false);
      }
    },
    [api, canManage, lane],
  );

  useEffect(() => {
    void load('page');
  }, [load]);

  const dayMax = Math.max(1, ...(stats?.byDay.map((row) => row.sent) ?? [1]));
  const num = (n: number) => <span className="tabular-nums">{formatInt(n)}</span>;
  const eventRows = useMemo(() => {
    const rows = Object.entries(stats?.byEvent ?? {}).map(([eventType, bucket]) => ({
      eventType,
      bucket,
    }));
    return filterByQuery(rows, eventQuery, (row) => row.eventType);
  }, [eventQuery, stats]);
  const eventTitle = sectionTitle(t('emailStatsByEvent'), eventRows.length);

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title={t('emailStatsTitle')}
        service="email-service"
        description={
          <>
            <span className="block">{t('emailStatsDescription')}</span>
            {baseUrl ? (
              <span className="mt-1 block font-mono text-xs text-muted-foreground">{baseUrl}</span>
            ) : null}
            {stats ? (
              <span className="mt-1 block text-xs text-muted-foreground">
                {t('emailStatsWindow', { from: stats.from, to: stats.to })}
              </span>
            ) : null}
          </>
        }
        actions={
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <select
                aria-label={t('emailMetricLane')}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={lane}
                onChange={(event) => setLane(event.target.value)}
              >
                <option value="">{t('emailStatsAllLanes')}</option>
                {EMAIL_LANES.map((item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {t(`emailLane_${item}`)}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void load('action')}
                disabled={loading}
              >
                <RefreshCw
                  aria-hidden
                  className={cn(
                    'mr-1.5 size-3.5',
                    loading && 'animate-spin motion-reduce:animate-none',
                  )}
                />
                {t('emailStatsRefresh')}
              </Button>
            </div>
            <ActionFeedback feedback={refreshFeedback} />
          </div>
        }
      />

      {!accessToken ? (
        <Alert variant="info">
          <AlertDescription>{t('dashboardNoSession')}</AlertDescription>
        </Alert>
      ) : null}
      {accessToken && !canManage ? (
        <Alert variant="warning">
          <AlertDescription>{t('emailForbidden')}</AlertDescription>
        </Alert>
      ) : null}
      {loading ? (
        <div className="space-y-4">
          <KpiSkeletonRow
            columns={6}
            label={t('emailLoading')}
          />
          <KpiSkeletonRow
            columns={3}
            label={t('emailLoading')}
          />
        </div>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{emailErrorText(t, error)}</AlertDescription>
        </Alert>
      ) : null}

      {stats && !loading ? (
        <>
          <KpiRow
            columns={6}
            label={t('emailStatsTitle')}
          >
            {COUNT_LABELS.map((item) => (
              <KpiCard
                key={item.key}
                label={t(item.labelKey)}
                value={formatInt(stats.totals[item.key])}
                hint={item.key === 'sent' ? t('emailStatsSentHint') : undefined}
                icon={item.icon}
              />
            ))}
          </KpiRow>

          <KpiRow
            columns={3}
            label={t('emailStatsSkipped')}
          >
            <KpiCard
              label={t('emailStatsSkipped')}
              value={formatInt(stats.skipped.total)}
              hint={t('emailStatsSkippedHint')}
              icon={Ban}
            />
            <KpiCard
              label={t('emailStatsNoRecipients')}
              value={formatInt(stats.skipped.noRecipients)}
              hint={t('emailStatsNoRecipientsHint')}
              icon={UserX}
            />
            <KpiCard
              label={t('emailStatsRuleDisabled')}
              value={formatInt(stats.skipped.ruleDisabled)}
              hint={t('emailStatsRuleDisabledHint')}
              icon={Inbox}
            />
          </KpiRow>

          {stats.byDay.length === 0 ? (
            <StatTableCard
              title={t('emailStatsByDay')}
              description={t('emailStatsSentHint')}
              columns={[{ label: t('statsColDay') }, { label: t('emailStatsSent') }]}
              rows={[]}
              empty={t('emailStatsEmpty')}
            />
          ) : (
            <BarSeriesCard
              title={t('emailStatsByDay')}
              description={t('emailStatsSentHint')}
              dayLabel={t('statsColDay')}
              valueLabel={t('emailStatsSent')}
              bars={stats.byDay.map((row, idx) => ({
                key: row.day,
                label: row.day.slice(5),
                value: row.sent,
                pct: Math.max((row.sent / dayMax) * 100, row.sent > 0 ? 4 : 0),
                title: `${row.day}: ${row.sent}`,
                recent: idx >= stats.byDay.length - 7,
              }))}
            />
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <StatTableCard
              title={t('emailStatsByLane')}
              columns={[
                { label: t('emailMetricLane') },
                { label: t('emailStatsSent'), className: 'text-right' },
                { label: t('emailStatsFailed'), className: 'text-right' },
              ]}
              rows={Object.entries(stats.byLane).map(([name, bucket]) => ({
                key: name,
                cells: [
                  <span className="font-mono text-xs">{name}</span>,
                  num(bucket.sent),
                  num(bucket.failed),
                ],
              }))}
              empty={t('emailStatsEmpty')}
            />
            <section className="min-w-0 space-y-3">
              {listNeedsSearch(Object.keys(stats.byEvent).length) ? (
                <SearchField
                  value={eventQuery}
                  onChange={setEventQuery}
                  placeholder={t('emailStatsSearch')}
                  label={t('emailStatsSearch')}
                />
              ) : null}
              <StatTableCard
                title={eventTitle}
                columns={[
                  { label: t('eventsColEvent') },
                  { label: t('emailStatsSent'), className: 'text-right' },
                  { label: t('emailStatsDelivered'), className: 'hidden text-right sm:table-cell' },
                  { label: t('emailStatsBounced'), className: 'hidden text-right sm:table-cell' },
                  { label: t('emailStatsFailed'), className: 'text-right' },
                ]}
                rows={eventRows.map((row) => ({
                  key: row.eventType,
                  cells: [
                    <span className="block min-w-0 truncate font-mono text-xs">
                      {row.eventType}
                    </span>,
                    num(row.bucket.sent),
                    num(row.bucket.delivered),
                    num(row.bucket.bounced),
                    num(row.bucket.failed),
                  ],
                }))}
                empty={t('emailStatsEmpty')}
              />
            </section>
          </div>
        </>
      ) : null}

      {metrics && !loading ? (
        <section className="space-y-4">
          <ServiceSectionHeader title={t('emailMetricsTitle')} />
          <p className="-mt-2 max-w-3xl text-sm text-muted-foreground">
            {t('emailMetricsDescription')}
          </p>
          <KpiRow label={t('emailMetricsTitle')}>
            {EMAIL_LANES.map((item) => (
              <KpiCard
                key={item}
                label={`${t('emailMetricQueueDepth')} · ${t(`emailLane_${item}`)}`}
                value={formatInt(metrics.queueDepth[item] ?? 0)}
                hint={t('emailMetricQueueAge', {
                  seconds: formatSeconds(metrics.queueAgeSeconds[item] ?? 0),
                })}
                icon={Timer}
              />
            ))}
            <KpiCard
              label={t('emailMetricAuthExpiries')}
              value={formatInt(metrics.authTtlExpiries)}
              icon={MailWarning}
            />
          </KpiRow>
          <div className="grid gap-4 lg:grid-cols-2">
            <StatTableCard
              title={t('emailMetricLatency')}
              columns={[
                { label: t('emailMetricLane') },
                { label: 'p50', className: 'text-right' },
                { label: 'p95', className: 'text-right' },
              ]}
              rows={EMAIL_LANES.map((item) => ({
                key: item,
                cells: [
                  t(`emailLane_${item}`),
                  <span className="tabular-nums">
                    {formatSeconds(metrics.latency[item]?.p50 ?? 0)}s
                  </span>,
                  <span className="tabular-nums">
                    {formatSeconds(metrics.latency[item]?.p95 ?? 0)}s
                  </span>,
                ],
              }))}
              empty={t('emailStatsEmpty')}
            />
            <StatTableCard
              title={sectionTitle(t('emailMetricProviderErrors'), metrics.providerErrors.length)}
              columns={[
                { label: t('identityStatsColProvider') },
                { label: t('scheduledJobsColError') },
                { label: t('hostingColCount'), className: 'text-right' },
              ]}
              rows={metrics.providerErrors.map((row) => ({
                key: `${row.provider}:${row.errorCode}`,
                cells: [
                  <span className="font-mono text-xs">{row.provider}</span>,
                  <span className="font-mono text-xs">
                    {row.errorCode || t('emailError_request_failed')}
                  </span>,
                  num(row.count),
                ],
              }))}
              empty={t('emailMetricNoProviderErrors')}
            />
          </div>
        </section>
      ) : null}

      {baseUrl ? (
        <DashboardScheduledJobsSection
          baseUrl={baseUrl}
          service="email"
        />
      ) : null}
    </div>
  );
}
