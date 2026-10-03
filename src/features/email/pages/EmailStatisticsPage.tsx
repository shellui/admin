import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';
import { BarChart3, Loader2, MailWarning, RefreshCw, Timer, Inbox } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import {
  ActionFeedback,
  feedbackFromError,
  type ActionFeedbackState,
} from '@/features/email/components/ActionFeedback';
import { SearchField } from '@/features/email/components/SearchField';
import { useEmailApi } from '@/features/email/useEmailApi';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { emailErrorText } from '@/lib/emailApiErrors';
import { filterByQuery, listNeedsSearch, sectionTitle } from '@/lib/emailList';
import { EMAIL_LANES, type EmailMetricsSnapshot } from '@/lib/emailMetrics';
import type { EmailCountBucket, EmailStats } from '@/lib/emailTypes';

function StatBlock({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
}) {
  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardDescription className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          {label}
        </CardDescription>
        <Icon
          className="size-4 text-muted-foreground"
          aria-hidden
        />
      </CardHeader>
      <CardContent>
        <p className="font-mono text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
        {hint ? <Text className="mt-1 font-mono text-xs">{hint}</Text> : null}
      </CardContent>
    </Card>
  );
}

function formatInt(n: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Math.round(n));
}

function formatSeconds(n: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(n);
}

const COUNT_LABELS: Array<{ key: keyof EmailCountBucket; labelKey: string }> = [
  { key: 'sent', labelKey: 'emailStatsSent' },
  { key: 'delivered', labelKey: 'emailStatsDelivered' },
  { key: 'bounced', labelKey: 'emailStatsBounced' },
  { key: 'complained', labelKey: 'emailStatsComplained' },
  { key: 'expired', labelKey: 'emailStatsExpired' },
  { key: 'failed', labelKey: 'emailStatsFailed' },
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
  const eventRows = useMemo(() => {
    const rows = Object.entries(stats?.byEvent ?? {}).map(([eventType, bucket]) => ({
      eventType,
      bucket,
    }));
    return filterByQuery(rows, eventQuery, (row) => row.eventType);
  }, [eventQuery, stats]);
  const eventTitle = sectionTitle(t('emailStatsByEvent'), eventRows.length);

  return (
    <div className="w-full space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
              {t('emailStatsTitle')}
            </h1>
            <Badge
              variant="secondary"
              className="font-mono text-[10px] uppercase"
            >
              email-service
            </Badge>
          </div>
          <Text className="max-w-3xl">{t('emailStatsDescription')}</Text>
          <Text className="font-mono text-xs text-muted-foreground">{baseUrl}</Text>
          {stats ? (
            <Text className="font-mono text-xs">
              {t('emailStatsWindow', { from: stats.from, to: stats.to })}
            </Text>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <select
              aria-label={t('emailMetricLane')}
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
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
            <button
              type="button"
              onClick={() => void load('action')}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted"
              disabled={loading}
            >
              <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
              {t('emailStatsRefresh')}
            </button>
          </div>
          <ActionFeedback feedback={refreshFeedback} />
        </div>
      </header>

      {!accessToken ? <Text>{t('dashboardNoSession')}</Text> : null}
      {accessToken && !canManage ? <Text>{t('emailForbidden')}</Text> : null}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t('emailLoading')}
        </div>
      ) : null}
      {error ? (
        <Text className="font-mono text-sm text-destructive">{emailErrorText(t, error)}</Text>
      ) : null}

      {stats && !loading ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {COUNT_LABELS.map((item) => (
              <StatBlock
                key={item.key}
                label={t(item.labelKey)}
                value={formatInt(stats.totals[item.key])}
                hint={item.key === 'sent' ? t('emailStatsSentHint') : undefined}
                icon={item.key === 'failed' || item.key === 'bounced' ? MailWarning : Inbox}
              />
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <StatBlock
              label={t('emailStatsSkipped')}
              value={formatInt(stats.skipped.total)}
              hint={t('emailStatsSkippedHint')}
              icon={MailWarning}
            />
            <StatBlock
              label={t('emailStatsNoRecipients')}
              value={formatInt(stats.skipped.noRecipients)}
              hint={t('emailStatsNoRecipientsHint')}
              icon={Inbox}
            />
            <StatBlock
              label={t('emailStatsRuleDisabled')}
              value={formatInt(stats.skipped.ruleDisabled)}
              hint={t('emailStatsRuleDisabledHint')}
              icon={Timer}
            />
          </div>

          <Card className="border-border/80 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="size-4" />
                {t('emailStatsByDay')}
              </CardTitle>
              <CardDescription>{t('emailStatsSentHint')}</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.byDay.length === 0 ? (
                <Text>{t('emailStatsEmpty')}</Text>
              ) : (
                <div
                  className="flex h-28 items-end gap-0.5"
                  aria-label={t('emailStatsByDay')}
                >
                  {stats.byDay.map((row) => (
                    <div
                      key={row.day}
                      className="flex h-full min-w-0 flex-1 items-end rounded-sm bg-muted"
                      title={`${row.day}: ${row.sent}`}
                    >
                      <div
                        className="w-full rounded-sm bg-primary"
                        style={{
                          height: `${Math.max((row.sent / dayMax) * 100, row.sent > 0 ? 4 : 0)}%`,
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-border/80 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">{t('emailStatsByLane')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.keys(stats.byLane).length === 0 ? (
                  <Text>{t('emailStatsEmpty')}</Text>
                ) : null}
                {Object.entries(stats.byLane).map(([name, bucket]) => (
                  <p
                    key={name}
                    className="flex justify-between gap-3 font-mono text-xs"
                  >
                    <span>{name}</span>
                    <span>
                      {t('emailStatsSent')} {formatInt(bucket.sent)} · {t('emailStatsFailed')}{' '}
                      {formatInt(bucket.failed)}
                    </span>
                  </p>
                ))}
              </CardContent>
            </Card>
            <Card className="border-border/80 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">{eventTitle}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {listNeedsSearch(Object.keys(stats.byEvent).length) ? (
                  <SearchField
                    value={eventQuery}
                    onChange={setEventQuery}
                    placeholder={t('emailStatsSearch')}
                    label={t('emailStatsSearch')}
                  />
                ) : null}
                {eventRows.length === 0 ? <Text>{t('emailStatsEmpty')}</Text> : null}
                {eventRows.map((row) => (
                  <p
                    key={row.eventType}
                    className="flex justify-between gap-3 font-mono text-xs"
                  >
                    <span className="min-w-0 truncate">{row.eventType}</span>
                    <span>
                      {formatInt(row.bucket.sent)} / {formatInt(row.bucket.delivered)} /{' '}
                      {formatInt(row.bucket.bounced)} / {formatInt(row.bucket.failed)}
                    </span>
                  </p>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      {metrics && !loading ? (
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">{t('emailMetricsTitle')}</h2>
            <Text>{t('emailMetricsDescription')}</Text>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {EMAIL_LANES.map((item) => (
              <StatBlock
                key={item}
                label={`${t('emailMetricQueueDepth')} · ${t(`emailLane_${item}`)}`}
                value={formatInt(metrics.queueDepth[item] ?? 0)}
                hint={t('emailMetricQueueAge', {
                  seconds: formatSeconds(metrics.queueAgeSeconds[item] ?? 0),
                })}
                icon={Timer}
              />
            ))}
            <StatBlock
              label={t('emailMetricAuthExpiries')}
              value={formatInt(metrics.authTtlExpiries)}
              icon={MailWarning}
            />
          </div>
          <Card className="border-border/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">{t('emailMetricLatency')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {EMAIL_LANES.map((item) => (
                <p
                  key={item}
                  className="font-mono text-xs"
                >
                  {t(`emailLane_${item}`)}:{' '}
                  {t('emailMetricLatencyValue', {
                    p50: formatSeconds(metrics.latency[item]?.p50 ?? 0),
                    p95: formatSeconds(metrics.latency[item]?.p95 ?? 0),
                  })}
                </p>
              ))}
            </CardContent>
          </Card>
          <Card className="border-border/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">
                {sectionTitle(t('emailMetricProviderErrors'), metrics.providerErrors.length)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {metrics.providerErrors.length === 0 ? (
                <Text>{t('emailMetricNoProviderErrors')}</Text>
              ) : null}
              {metrics.providerErrors.map((row) => (
                <p
                  key={`${row.provider}:${row.errorCode}`}
                  className="font-mono text-xs"
                >
                  {row.provider} · {row.errorCode || t('emailError_request_failed')} ·{' '}
                  {formatInt(row.count)}
                </p>
              ))}
            </CardContent>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
