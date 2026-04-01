import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';
import { Activity, Cpu, Database, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Text } from '@/components/ui/text';

function StatBlock({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
}) {
  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardDescription className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          {label}
        </CardDescription>
        <Icon className="size-4 text-muted-foreground" aria-hidden />
      </CardHeader>
      <CardContent>
        <p className="font-mono text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
        <Text className="mt-1 font-mono text-xs">{hint}</Text>
      </CardContent>
    </Card>
  );
}

/** Placeholder bars suggesting a time-series or histogram panel */
function ChartPlaceholder({ caption }: { caption: string }) {
  const heights = [40, 65, 35, 80, 55, 90, 45, 70, 50, 85, 60, 75];
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4">
      <div className="mb-3 flex items-center justify-between">
        <Text asChild className="font-mono text-xs">
          <span>{caption}</span>
        </Text>
        <Badge variant="muted" className="font-mono text-[10px]">
          mock
        </Badge>
      </div>
      <div className="flex h-36 items-end gap-1">
        {heights.map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-primary/20 ring-1 ring-inset ring-primary/30"
            style={{ height: `${h}%` }}
            title={`t+${i}m`}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-muted-foreground">
        <span>t0</span>
        <span>t+6m</span>
        <span>t+12m</span>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { t } = useTranslation();

  return (
    <div className="w-full space-y-8">
      <header className="space-y-1">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
            {t('dashboardTitle')}
          </h1>
          <Badge variant="secondary" className="font-mono text-[10px] uppercase">
            {t('dashboardEnvBadge')}
          </Badge>
        </div>
        <Text className="max-w-3xl font-mono">{t('dashboardDescription')}</Text>
      </header>

      <section
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label={t('dashboardKpiSection')}
      >
        <StatBlock
          label={t('dashboardStatRequests')}
          value="12.4k"
          hint={t('dashboardStatRequestsHint')}
          icon={Activity}
        />
        <StatBlock
          label={t('dashboardStatLatency')}
          value="142ms"
          hint={t('dashboardStatLatencyHint')}
          icon={Cpu}
        />
        <StatBlock
          label={t('dashboardStatStorage')}
          value="2.1 GB"
          hint={t('dashboardStatStorageHint')}
          icon={Database}
        />
        <StatBlock
          label={t('dashboardStatAuth')}
          value="99.2%"
          hint={t('dashboardStatAuthHint')}
          icon={ShieldCheck}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="border-border/80 lg:col-span-3">
          <CardHeader>
            <CardTitle className="font-heading text-lg">{t('dashboardChartTitle')}</CardTitle>
            <CardDescription className="font-mono text-xs">
              {t('dashboardChartDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartPlaceholder caption={t('dashboardChartCaption')} />
          </CardContent>
        </Card>

        <Card className="border-border/80 lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-heading text-lg">{t('dashboardFeedTitle')}</CardTitle>
            <CardDescription className="font-mono text-xs">
              {t('dashboardFeedDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-0">
            <ul className="divide-y divide-border font-mono text-xs">
              {[t('dashboardFeedItem1'), t('dashboardFeedItem2'), t('dashboardFeedItem3')].map(
                (line, i) => (
                  <li key={i} className="flex gap-2 py-2.5">
                    <span className="shrink-0 text-[10px] text-primary/70">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <Text asChild className="min-w-0 break-all font-mono text-xs">
                      <span>{line}</span>
                    </Text>
                  </li>
                ),
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Separator className="bg-border" />

      <Text className="font-mono text-xs">{t('dashboardUiHint')}</Text>
    </div>
  );
}
