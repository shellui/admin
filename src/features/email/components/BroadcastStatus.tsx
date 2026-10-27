import { useTranslation } from 'react-i18next';
import { StatusBadge, type StatusTone } from '@/components/admin/StatusBadge';
import {
  BROADCAST_COUNT_KEYS,
  type BroadcastCounts,
  type BroadcastState,
} from '@/lib/emailBroadcasts';

export function BroadcastStateBadge({ state }: { state: BroadcastState }) {
  const { t } = useTranslation();
  const tone: StatusTone =
    state === 'sent'
      ? 'success'
      : state === 'failed'
        ? 'destructive'
        : state === 'draft'
          ? 'muted'
          : 'info';
  return (
    <StatusBadge
      tone={tone}
      dot
    >
      {t(`emailBroadcastState_${state}`)}
    </StatusBadge>
  );
}

/** Recipients by outcome. Empty outcomes are left out. */
export function BroadcastCountsGrid({ counts }: { counts: BroadcastCounts }) {
  const { t } = useTranslation();
  const shown = BROADCAST_COUNT_KEYS.filter((key) => counts[key] > 0);
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {(['total', ...shown] as const).map((key) => (
        <div
          key={key}
          className="rounded-xl border border-border bg-card p-4 shadow-sm"
        >
          <dt className="text-[13px] text-muted-foreground">{t(`emailBroadcastCount_${key}`)}</dt>
          <dd className="mt-1 font-heading text-2xl font-semibold tabular-nums">
            {key === 'total' ? counts.total : counts[key]}
          </dd>
        </div>
      ))}
    </dl>
  );
}
