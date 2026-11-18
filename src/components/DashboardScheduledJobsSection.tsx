import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import { StatusBadge, type StatusTone } from '@/components/admin/StatusBadge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
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
  type ScheduledJobsService,
} from '@/lib/scheduledJobsApi';
import { cn } from '@/lib/utils';
import { webhookDeliveryDetailPath } from '@/lib/webhookRoutePaths';

const RECENT_RUNS = 10;

function healthTone(health: string): StatusTone {
  if (health === 'healthy') return 'success';
  if (health === 'failing') return 'destructive';
  if (health === 'overdue') return 'warning';
  return 'muted';
}

function runStatusClassName(status: string): string {
  return `tone-${runStatusTone(status)} rounded border px-1.5 py-0.5`;
}

function runStatusTone(status: string): StatusTone {
  if (status === 'succeeded') return 'success';
  if (status === 'running') return 'info';
  if (status === 'failed') return 'destructive';
  return 'muted';
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
    <div className="min-w-0 space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className="text-sm font-medium tabular-nums"
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
    return <p className="text-sm text-muted-foreground">{t('scheduledJobsNoCounts')}</p>;
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

function RunCorrelation({
  run,
  companyId,
  baseUrl,
  service,
}: {
  run: ScheduledJobRun;
  companyId: number | null;
  baseUrl?: string;
  service: ScheduledJobsService;
}) {
  const { t } = useTranslation();
  const accessToken = useShelluiAccessToken();
  const [detail, setDetail] = useState<ScheduledJobRunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    setError(null);
    const request = baseUrl
      ? fetchScheduledJobRun(accessToken, run.id, baseUrl)
      : fetchScheduledJobRun(accessToken, run.id);
    request
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
  }, [accessToken, baseUrl, run.id, t]);

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
                {companyId != null && a.company_id === companyId && service !== 'email' ? (
                  <Link
                    to={webhookDeliveryDetailPath(service, a.delivery_id)}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {t('scheduledJobsOpenDelivery')}
                  </Link>
                ) : companyId != null && a.company_id === companyId ? (
                  <span className="text-muted-foreground">{t('scheduledJobsThisCompany')}</span>
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
  baseUrl,
  service,
}: {
  job: string;
  runs: ScheduledJobRun[];
  companyId: number | null;
  baseUrl?: string;
  service: ScheduledJobsService;
}) {
  const { t } = useTranslation();
  const fmt = useDateFormatters();
  const [openRunId, setOpenRunId] = useState<number | null>(null);

  if (runs.length === 0) {
    return <p className="px-3 py-4 text-sm text-muted-foreground">{t('scheduledJobsNoRuns')}</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('scheduledJobsColStarted')}</TableHead>
          <TableHead>{t('scheduledJobsColStatus')}</TableHead>
          <TableHead className="hidden sm:table-cell">{t('scheduledJobsColTrigger')}</TableHead>
          <TableHead>{t('scheduledJobsColDuration')}</TableHead>
          <TableHead className="hidden md:table-cell">{t('scheduledJobsColCounts')}</TableHead>
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
                className="whitespace-nowrap text-xs"
                title={fmt.absolute(run.started_at)}
              >
                {fmt.relative(run.started_at) ?? '-'}
              </TableCell>
              <TableCell>
                <StatusBadge tone={runStatusTone(run.status)}>
                  {t(runStatusLabelKey(run.status))}
                </StatusBadge>
              </TableCell>
              <TableCell className="hidden text-xs sm:table-cell">
                {t(`scheduledJobsTrigger_${run.trigger}`, { defaultValue: run.trigger })}
              </TableCell>
              <TableCell className="font-mono text-xs tabular-nums">
                {fmt.duration(run.duration_ms) ?? '-'}
              </TableCell>
              <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
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
                className="text-xs text-destructive"
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
              <TableRow
                key={`${run.id}-detail`}
                className="bg-muted/30 hover:bg-muted/30"
              >
                <TableCell colSpan={7}>
                  <RunCorrelation
                    run={run}
                    companyId={companyId}
                    baseUrl={baseUrl}
                    service={service}
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
  baseUrl,
  service,
}: {
  status: ScheduledJobStatus;
  runs: ScheduledJobRun[];
  companyId: number | null;
  baseUrl?: string;
  service: ScheduledJobsService;
}) {
  const { t, i18n } = useTranslation();
  const fmt = useDateFormatters();
  const last = status.last_run;
  const genericKey = `scheduledJobsJobDescription_${status.job}`;
  const emailKey = `scheduledJobsJobDescriptionEmail_${status.job}`;
  const descriptionKeyForJob = service === 'email' && i18n.exists(emailKey) ? emailKey : genericKey;
  return (
    <Card
      className="overflow-hidden rounded-xl border-border shadow-xs"
      data-testid={`scheduled-job-${status.job}`}
    >
      <CardHeader className="space-y-1.5 border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-sm font-semibold">{t(jobLabelKey(status.job))}</CardTitle>
          <code className="font-mono text-[11px] text-muted-foreground">{status.job}</code>
          <StatusBadge tone={healthTone(status.health)}>
            {t(healthLabelKey(status.health))}
          </StatusBadge>
          {status.overdue && status.health === 'failing' && (
            <StatusBadge tone={healthTone('overdue')}>
              {t('scheduledJobsHealth_overdue')}
            </StatusBadge>
          )}
        </div>
        <CardDescription className="text-xs">
          {t(descriptionKeyForJob, {
            defaultValue: '',
            minutes: Math.round(status.overdue_after_seconds / 60),
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 pt-4">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
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
          <p className="text-xs font-medium text-muted-foreground">
            {t('scheduledJobsLastCounts')}
          </p>
          <CountsList
            job={status.job}
            counts={status.last_counts}
          />
        </div>
        <details className="group rounded-lg border border-border">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-medium marker:content-none [&::-webkit-details-marker]:hidden">
            <ChevronRight
              className="size-4 text-muted-foreground transition-transform group-open:rotate-90 motion-reduce:transition-none"
              aria-hidden
            />
            {t('scheduledJobsRecentRuns')}
            <span className="text-xs font-normal text-muted-foreground">{runs.length}</span>
          </summary>
          <div className="border-t border-border">
            <RunsTable
              job={status.job}
              runs={runs}
              companyId={companyId}
              baseUrl={baseUrl}
              service={service}
            />
          </div>
        </details>
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
      <StatusBadge tone={healthTone(overview.scheduler_enabled ? 'healthy' : 'disabled')}>
        {t(
          overview.scheduler_enabled
            ? 'scheduledJobsSchedulerEnabled'
            : 'scheduledJobsSchedulerDisabled',
        )}
      </StatusBadge>
      <StatusBadge
        tone={healthTone(
          overview.redis_reachable === false
            ? 'failing'
            : overview.redis_reachable
              ? 'healthy'
              : 'disabled',
        )}
      >
        {t(redisKey)}
      </StatusBadge>
      {overview.scheduler_enabled && (
        <StatusBadge
          tone={healthTone(overview.beat_stale ? 'overdue' : 'healthy')}
          title={fmt.absolute(overview.beat_last_seen_at)}
        >
          {overview.beat_last_seen_at
            ? t(overview.beat_stale ? 'scheduledJobsBeatStale' : 'scheduledJobsBeatSeen', {
                when: fmt.relative(overview.beat_last_seen_at),
              })
            : t('scheduledJobsBeatNever')}
        </StatusBadge>
      )}
    </div>
  );
}

function descriptionKey(service: ScheduledJobsService): string {
  if (service === 'hosting') return 'scheduledJobsDescriptionHosting';
  if (service === 'storage') return 'scheduledJobsDescriptionStorage';
  if (service === 'email') return 'scheduledJobsDescriptionEmail';
  return 'scheduledJobsDescription';
}

/**
 * Scheduled jobs for one service for Django staff.
 * Email also includes `sweep_email_queue`.
 * Hidden for everyone else; each API answers 403 to non-staff, including company owners.
 * Scheduler health is platform-wide, so it stays inside this staff-only section.
 */
export function DashboardScheduledJobsSection({
  baseUrl,
  service = 'identity',
}: {
  /** Service origin. Omit it to use the identity-service base URL. */
  baseUrl?: string;
  service?: ScheduledJobsService;
} = {}) {
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
      const next = baseUrl
        ? await fetchScheduledJobs(accessToken, baseUrl)
        : await fetchScheduledJobs(accessToken);
      const runLists = await Promise.all(
        next.jobs.map((j) =>
          baseUrl
            ? fetchScheduledJobRuns(accessToken, j.job, RECENT_RUNS, baseUrl)
            : fetchScheduledJobRuns(accessToken, j.job, RECENT_RUNS),
        ),
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
  }, [accessToken, baseUrl, isStaff, t]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload on session, staff, or service URL
  }, [accessToken, baseUrl, isStaff]);

  if (!accessToken || !isStaff || forbidden) return null;

  return (
    <section
      className="space-y-4"
      aria-labelledby="scheduled-jobs-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              id="scheduled-jobs-heading"
              className="font-heading text-lg font-semibold tracking-tight"
            >
              {t('scheduledJobsTitle')}
            </h2>
            <StatusBadge tone="gold">{t('scheduledJobsStaffBadge')}</StatusBadge>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">{t(descriptionKey(service))}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? (
            <Loader2
              className="size-3.5 animate-spin motion-reduce:animate-none"
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
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>
            {t('scheduledJobsError')} {error}
          </AlertDescription>
        </Alert>
      ) : null}

      {overview ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-xs">
          <span className="text-sm font-medium">{t('scheduledJobsSchedulerStatus')}</span>
          <SchedulerBadges overview={overview} />
        </div>
      ) : null}

      {!overview && loading ? (
        <div
          className="space-y-3"
          aria-busy="true"
          aria-label={t('scheduledJobsLoading')}
        >
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : null}

      {overview && (
        <div className="grid gap-4">
          {overview.jobs.map((job) => (
            <JobCard
              key={job.job}
              status={job}
              runs={runs[job.job] ?? []}
              companyId={companyId}
              baseUrl={baseUrl}
              service={service}
            />
          ))}
        </div>
      )}
    </section>
  );
}
