import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import {
  BROADCAST_COUNT_KEYS,
  type BroadcastCounts,
  type BroadcastState,
} from '@/lib/emailBroadcasts';

export function BroadcastStateBadge({ state }: { state: BroadcastState }) {
  const { t } = useTranslation();
  const variant = state === 'sent' ? 'default' : state === 'draft' ? 'muted' : 'outline';
  return (
    <Badge
      variant={variant}
      className={state === 'failed' ? 'border-destructive text-destructive' : undefined}
    >
      {t(`emailBroadcastState_${state}`)}
    </Badge>
  );
}

/** Recipients by outcome. Empty outcomes are left out. */
export function BroadcastCountsGrid({ counts }: { counts: BroadcastCounts }) {
  const { t } = useTranslation();
  const shown = BROADCAST_COUNT_KEYS.filter((key) => counts[key] > 0);
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <div className="rounded-md border border-border p-3">
        <dt className="text-xs text-muted-foreground">{t('emailBroadcastCount_total')}</dt>
        <dd className="font-heading text-xl font-semibold tabular-nums">{counts.total}</dd>
      </div>
      {shown.map((key) => (
        <div
          key={key}
          className="rounded-md border border-border p-3"
        >
          <dt className="text-xs text-muted-foreground">{t(`emailBroadcastCount_${key}`)}</dt>
          <dd className="font-heading text-xl font-semibold tabular-nums">{counts[key]}</dd>
        </div>
      ))}
    </dl>
  );
}
