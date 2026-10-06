import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, Clock, Loader2, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useShelluiIsStaff } from '@/hooks/useShelluiIsStaff';
import { getCompanyIdFromJwt } from '@/lib/jwtCompany';
import {
  ScheduledJobsForbiddenError,
  errorLabelKey,
  fetchScheduledJobRun,
  fetchScheduledJobRuns,
  fetchScheduledJobs,
  formatDurationMs,
  formatRelativeTime,
  healthLabelKey,
  jobLabelKey,
  orderedCounts,
  runStatusLabelKey,
  type ScheduledJobRun,
  type ScheduledJobRunDetail,
  type ScheduledJobStatus,
  type ScheduledJobsOverview,
} from '@/lib/scheduledJobsApi';
import { cn } from '@/lib/utils';
import { webhookDeliveryDetailPath } from '@/lib/webhookRoutePaths';

const RECENT_RUNS = 10;

function healthClassName(health: string): string {
  if (health === 'healthy')
    return 'border-transparent bg-emerald-500/15 text-emerald-800 dark:text-emerald-200';
  if (health === 'failing') return 'border-transparent bg-destructive/15 text-destructive';
  if (health === 'overdue')
    return 'border-transparent bg-amber-500/15 text-amber-900 dark:text-amber-100';
  return 'border-border bg-muted/50 text-muted-foreground';
}

function runStatusClassName(status: string): string {
  if (status === 'succeeded') return 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200';
  if (status === 'running') return 'bg-sky-500/15 text-sky-900 dark:text-sky-100';
  if (status === 'failed') return 'bg-destructive/15 text-destructive';
  return 'bg-muted text-muted-foreground';
}

function useDateFormatters() {
  const { i18n } = useTranslation();
  const locale = i18n.language || 'en';
  const absolute = (iso: string | null | undefined) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'medium' }).format(d);
  };
  return {
    locale,
    absolute,
    relative: (iso: string | null | undefined) => formatRelativeTime(iso, locale),
    duration: (ms: number | null | undefined) => formatDurationMs(ms, locale),
  };
}

function Fact({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="space-y-0.5">
      <dt className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd
        className="font-mono text-sm tabular-nums"
        title={title}
      >
        {value}
      </dd>
    </div>
  );
}

function CountsList({ job, counts }: { job: string; counts: ScheduledJobRun['counts'] }) {
  const { t } = useTranslation();
  const rows = orderedCounts(job, counts);
  if (rows.length === 0) {
    return (
      <Text className="font-mono text-xs text-muted-foreground">{t('scheduledJobsNoCounts')}</Text>
    );
  }
  return (
    <ul className="grid gap-x-6 gap-y-1 font-mono text-xs sm:grid-cols-2">
      {rows.map(({ key, value }) => (
        <li
          key={key}
          className="flex justify-between gap-3"
        >
          <span className="text-muted-foreground">
            {t(`scheduledJobsCount_${key}`, { defaultValue: key })}
          </span>
          <span className="tabular-nums">{value}</span>
        </li>
      ))}
    </ul>
  );
}

function RunCorrelation({ run, companyId }: { run: ScheduledJobRun; companyId: number | null }) {
  const { t } = useTranslation();
  const accessToken = useShelluiAccessToken();
  const [detail, setDetail] = useState<ScheduledJobRunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    setError(null);
    fetchScheduledJobRun(accessToken, run.id)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : t('scheduledJobsCorrelationError'));
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, run.id, t]);

  if (error) {
    return (
      <Text
        role="alert"
        className="font-mono text-xs text-destructive"
      >
        {t('scheduledJobsCorrelationError')} {error}
      </Text>
    );
  }
  if (!detail) {
    return (
      <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
        <Loader2
          className="size-3.5 animate-spin"
          aria-hidden
        />
        {t('scheduledJobsCorrelationLoading')}
      </div>
    );
  }
  const attempts = detail.webhook_delivery_attempts;
  const emails = detail.email_events;
  return (
    <div className="space-y-3 font-mono text-xs">
      <Text className="font-mono text-[11px] text-muted-foreground">
        {t('scheduledJobsRequestId', { id: detail.request_id })}
      </Text>
      <div className="space-y-1">
        <p className="font-medium">
          {t('scheduledJobsCorrelationWebhooks', { count: attempts.length })}
        </p>
        {attempts.length === 0 ? (
          <p className="text-muted-foreground">{t('scheduledJobsCorrelationNone')}</p>
        ) : (
          <ul className="space-y-1">
            {attempts.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center gap-2"
              >
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5',
                    a.status === 'success'
                      ? runStatusClassName('succeeded')
                      : runStatusClassName('failed'),
                  )}
                >
                  {t(
                    a.status === 'success'
                      ? 'scheduledJobsAttemptSuccess'
                      : 'scheduledJobsAttemptFailure',
                  )}
                </span>
                <span>{a.event_type}</span>
                {a.http_status != null && (
                  <span className="text-muted-foreground">HTTP {a.http_status}</span>
                )}
                {companyId != null && a.company_id === companyId ? (
                  <Link
                    to={webhookDeliveryDetailPath('identity', a.delivery_id)}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {t('scheduledJobsOpenDelivery')}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">
                    {t('scheduledJobsOtherCompany', { id: a.company_id })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {detail.webhook_delivery_attempts_truncated && (
          <p className="text-muted-foreground">{t('scheduledJobsCorrelationTruncated')}</p>
        )}
      </div>
      <div className="space-y-1">
        <p className="font-medium">
          {t('scheduledJobsCorrelationEmails', { count: emails.length })}
        </p>
        {emails.length === 0 ? (
          <p className="text-muted-foreground">{t('scheduledJobsCorrelationNone')}</p>
        ) : (
          <ul className="space-y-1">
            {emails.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center gap-2"
              >
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5',
                    e.status === 'delivered'
                      ? runStatusClassName('succeeded')
                      : runStatusClassName(
                          e.status === 'dead' || e.status === 'failed' ? 'failed' : 'running',
                        ),
                  )}
                >
                  {t(`scheduledJobsEmailStatus_${e.status}`, { defaultValue: e.status })}
                </span>
                <span>{e.event_type}</span>
                <span className="text-muted-foreground">
                  {companyId != null && e.company_id === companyId
                    ? t('scheduledJobsThisCompany')
                    : t('scheduledJobsOtherCompany', { id: e.company_id })}
                </span>
              </li>
            ))}
          </ul>
        )}
        {detail.email_events_truncated && (
          <p className="text-muted-foreground">{t('scheduledJobsCorrelationTruncated')}</p>
        )}
      </div>
    </div>
  );
}

function RunsTable({
  job,
  runs,
  companyId,
}: {
  job: string;
  runs: ScheduledJobRun[];
  companyId: number | null;
}) {
  const { t } = useTranslation();
  const fmt = useDateFormatters();
  const [openRunId, setOpenRunId] = useState<number | null>(null);

  if (runs.length === 0) {
    return (
      <Text className="font-mono text-xs text-muted-foreground">{t('scheduledJobsNoRuns')}</Text>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('scheduledJobsColStarted')}</TableHead>
          <TableHead>{t('scheduledJobsColStatus')}</TableHead>
          <TableHead>{t('scheduledJobsColTrigger')}</TableHead>
          <TableHead>{t('scheduledJobsColDuration')}</TableHead>
          <TableHead>{t('scheduledJobsColCounts')}</TableHead>
          <TableHead>{t('scheduledJobsColError')}</TableHead>
          <TableHead className="text-right">{t('scheduledJobsColCorrelation')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.map((run) => {
          const open = openRunId === run.id;
          const nonZero = orderedCounts(job, run.counts).filter((c) => c.value > 0);
          const errorKey = errorLabelKey(run.error_key);
          return [
            <TableRow key={run.id}>
              <TableCell
                className="whitespace-nowrap font-mono text-xs"
                title={fmt.absolute(run.started_at)}
              >
                {fmt.relative(run.started_at) ?? '-'}
              </TableCell>
              <TableCell>
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 font-mono text-xs',
                    runStatusClassName(run.status),
                  )}
                >
                  {t(runStatusLabelKey(run.status))}
                </span>
              </TableCell>
              <TableCell className="font-mono text-xs">
                {t(`scheduledJobsTrigger_${run.trigger}`, { defaultValue: run.trigger })}
              </TableCell>
              <TableCell className="font-mono text-xs tabular-nums">
                {fmt.duration(run.duration_ms) ?? '-'}
              </TableCell>
              <TableCell className="font-mono text-xs">
                {nonZero.length === 0
                  ? t('scheduledJobsNothingToDo')
                  : nonZero
                      .map(
                        (c) =>
                          `${t(`scheduledJobsCount_${c.key}`, { defaultValue: c.key })}: ${c.value}`,
                      )
                      .join(', ')}
              </TableCell>
              <TableCell
                className="font-mono text-xs text-destructive"
                title={[run.error_class, run.error_message].filter(Boolean).join(': ') || undefined}
              >
                {errorKey ? t(errorKey) : ''}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-expanded={open}
                  onClick={() => setOpenRunId(open ? null : run.id)}
                >
                  {open ? (
                    <ChevronDown
                      className="size-3.5"
                      aria-hidden
                    />
                  ) : (
                    <ChevronRight
                      className="size-3.5"
                      aria-hidden
                    />
                  )}
                  {t('scheduledJobsShowCorrelation')}
                </Button>
              </TableCell>
            </TableRow>,
            open ? (
              <TableRow key={`${run.id}-detail`}>
                <TableCell colSpan={7}>
                  <RunCorrelation
                    run={run}
                    companyId={companyId}
                  />
                </TableCell>
              </TableRow>
            ) : null,
          ];
        })}
      </TableBody>
    </Table>
  );
}

function JobCard({
  status,
  runs,
  companyId,
}: {
  status: ScheduledJobStatus;
  runs: ScheduledJobRun[];
  companyId: number | null;
}) {
  const { t } = useTranslation();
  const fmt = useDateFormatters();
  const last = status.last_run;
  return (
    <Card
      className="border-border/80 shadow-sm"
      data-testid={`scheduled-job-${status.job}`}
    >
      <CardHeader className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="font-heading text-base">{t(jobLabelKey(status.job))}</CardTitle>
          <code className="font-mono text-[11px] text-muted-foreground">{status.job}</code>
          <Badge className={healthClassName(status.health)}>
            {t(healthLabelKey(status.health))}
          </Badge>
          {status.overdue && status.health === 'failing' && (
            <Badge className={healthClassName('overdue')}>{t('scheduledJobsHealth_overdue')}</Badge>
          )}
        </div>
        <CardDescription className="font-mono text-xs">
          {t(`scheduledJobsJobDescription_${status.job}`, {
            defaultValue: '',
            minutes: Math.round(status.overdue_after_seconds / 60),
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <dl className="grid gap-4 sm:grid-cols-3 xl:grid-cols-6">
          <Fact
            label={t('scheduledJobsLastRun')}
            value={
              last
                ? `${fmt.relative(last.started_at) ?? '-'} · ${t(runStatusLabelKey(last.status))}`
                : t('scheduledJobsNever')
            }
            title={fmt.absolute(last?.started_at)}
          />
          <Fact
            label={t('scheduledJobsLastSuccess')}
            value={fmt.relative(status.last_success_at) ?? t('scheduledJobsNever')}
            title={fmt.absolute(status.last_success_at)}
          />
          <Fact
            label={t('scheduledJobsDuration')}
            value={fmt.duration(status.last_duration_ms) ?? '-'}
          />
          <Fact
            label={t('scheduledJobsNextExpected')}
            value={fmt.relative(status.next_expected_at) ?? '-'}
            title={fmt.absolute(status.next_expected_at)}
          />
          <Fact
            label={t('scheduledJobsLast24h')}
            value={t('scheduledJobsLast24hValue', {
              succeeded: status.last_24h.succeeded,
              failed: status.last_24h.failed,
            })}
          />
          <Fact
            label={t('scheduledJobsSkipped')}
            value={String(status.skipped_locked_total)}
            title={fmt.absolute(status.last_skipped_at)}
          />
        </dl>
        <div className="space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            {t('scheduledJobsLastCounts')}
          </p>
          <CountsList
            job={status.job}
            counts={status.last_counts}
          />
        </div>
        <div className="space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            {t('scheduledJobsRecentRuns')}
          </p>
          <RunsTable
            job={status.job}
            runs={runs}
            companyId={companyId}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function SchedulerBadges({ overview }: { overview: ScheduledJobsOverview }) {
  const { t } = useTranslation();
  const fmt = useDateFormatters();
  const redisKey =
    overview.redis_reachable == null
      ? 'scheduledJobsRedisNotConfigured'
      : overview.redis_reachable
        ? 'scheduledJobsRedisReachable'
        : 'scheduledJobsRedisUnreachable';
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      aria-label={t('scheduledJobsSchedulerStatus')}
    >
      <Badge className={healthClassName(overview.scheduler_enabled ? 'healthy' : 'disabled')}>
        {t(
          overview.scheduler_enabled
            ? 'scheduledJobsSchedulerEnabled'
            : 'scheduledJobsSchedulerDisabled',
        )}
      </Badge>
      <Badge
        className={healthClassName(
          overview.redis_reachable === false
            ? 'failing'
            : overview.redis_reachable
              ? 'healthy'
              : 'disabled',
        )}
      >
        {t(redisKey)}
      </Badge>
      {overview.scheduler_enabled && (
        <Badge
          className={healthClassName(overview.beat_stale ? 'overdue' : 'healthy')}
          title={fmt.absolute(overview.beat_last_seen_at)}
        >
          {overview.beat_last_seen_at
            ? t(overview.beat_stale ? 'scheduledJobsBeatStale' : 'scheduledJobsBeatSeen', {
                when: fmt.relative(overview.beat_last_seen_at),
              })
            : t('scheduledJobsBeatNever')}
        </Badge>
      )}
    </div>
  );
}

/**
 * identity-service scheduled jobs (`retry_webhooks`, `purge_expired_data`) for Django staff.
 * Hidden for everyone else; the API also answers 403 to non-staff, including company owners.
 */
export function DashboardScheduledJobsSection() {
  const { t } = useTranslation();
  const accessToken = useShelluiAccessToken();
  const isStaff = useShelluiIsStaff();
  const [overview, setOverview] = useState<ScheduledJobsOverview | null>(null);
  const [runs, setRuns] = useState<Record<string, ScheduledJobRun[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const companyId = accessToken ? getCompanyIdFromJwt(accessToken) : null;

  const load = useCallback(async () => {
    if (!accessToken || !isStaff) return;
    setLoading(true);
    setError(null);
    try {
      const next = await fetchScheduledJobs(accessToken);
      const runLists = await Promise.all(
        next.jobs.map((j) => fetchScheduledJobRuns(accessToken, j.job, RECENT_RUNS)),
      );
      setOverview(next);
      setRuns(Object.fromEntries(next.jobs.map((j, i) => [j.job, runLists[i]])));
    } catch (e) {
      if (e instanceof ScheduledJobsForbiddenError) {
        setForbidden(true);
      } else {
        setError(e instanceof Error ? e.message : t('scheduledJobsError'));
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, isStaff, t]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload on session or staff change only
  }, [accessToken, isStaff]);

  if (!accessToken || !isStaff || forbidden) return null;

  return (
    <section
      className="space-y-4"
      aria-labelledby="scheduled-jobs-heading"
    >
      <div className="flex flex-wrap items-baseline gap-3">
        <h2
          id="scheduled-jobs-heading"
          className="font-heading text-lg font-semibold tracking-tight"
        >
          {t('scheduledJobsTitle')}
        </h2>
        <Badge
          variant="secondary"
          className="font-mono text-[10px] uppercase"
        >
          {t('scheduledJobsStaffBadge')}
        </Badge>
      </div>
      <Text className="max-w-3xl font-mono text-sm">{t('scheduledJobsDescription')}</Text>

      <div className="flex flex-wrap items-center gap-3">
        {overview && <SchedulerBadges overview={overview} />}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? (
            <Loader2
              className="size-3.5 animate-spin"
              aria-hidden
            />
          ) : (
            <RefreshCw
              className="size-3.5"
              aria-hidden
            />
          )}
          {t('scheduledJobsRefresh')}
        </Button>
        {error && (
          <Text
            role="alert"
            className="font-mono text-xs text-destructive"
          >
            {t('scheduledJobsError')} {error}
          </Text>
        )}
      </div>

      {!overview && loading && (
        <div className="flex items-center gap-2 font-mono text-sm text-muted-foreground">
          <Clock
            className="size-4"
            aria-hidden
          />
          {t('scheduledJobsLoading')}
        </div>
      )}

      {overview && (
        <div className="grid gap-4">
          {overview.jobs.map((job) => (
            <JobCard
              key={job.job}
              status={job}
              runs={runs[job.job] ?? []}
              companyId={companyId}
            />
          ))}
        </div>
      )}
    </section>
  );
}
