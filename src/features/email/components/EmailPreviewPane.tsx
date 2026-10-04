import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Monitor, Smartphone } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { SegmentedControl } from '@/features/email/components/SegmentedControl';
import { cn } from '@/lib/utils';

type Device = 'desktop' | 'mobile';

export function EmailPreviewPane({
  html,
  failed,
  subject,
  preheader,
  large = false,
}: {
  html: string | null;
  failed: boolean;
  subject: string;
  preheader: string;
  large?: boolean;
}) {
  const { t } = useTranslation();
  const [device, setDevice] = useState<Device>('desktop');
  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold tracking-tight">{t('emailPreview')}</h2>
        <SegmentedControl
          label={t('emailPreviewDevice')}
          value={device}
          onChange={setDevice}
          options={[
            { value: 'desktop', label: t('emailDeviceDesktop'), icon: <Monitor /> },
            { value: 'mobile', label: t('emailDeviceMobile'), icon: <Smartphone /> },
          ]}
        />
      </div>
      <Text className="text-xs">{t('emailPreviewThemed')}</Text>
      <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-3">
        <div
          className={cn(
            'mx-auto min-w-0 rounded-md border border-border bg-card px-3 py-2 transition-[width]',
            device === 'mobile' ? 'w-[375px] max-w-full' : 'w-full',
          )}
        >
          <p className="truncate text-sm font-semibold">{subject || '\u00a0'}</p>
          {preheader ? <p className="truncate text-xs text-muted-foreground">{preheader}</p> : null}
        </div>
        {html ? (
          <iframe
            title={t('emailPreview')}
            sandbox=""
            srcDoc={html}
            className={cn(
              'mx-auto block rounded-md border border-border bg-white transition-[width]',
              device === 'mobile' ? 'w-[375px] max-w-full' : 'w-full',
              large ? 'h-[46rem]' : 'h-[36rem]',
            )}
          />
        ) : failed ? (
          <Text className="p-4 text-sm text-muted-foreground">{t('emailPreviewUnavailable')}</Text>
        ) : (
          <Skeleton className={cn('w-full', large ? 'h-[46rem]' : 'h-[36rem]')} />
        )}
      </div>
    </div>
  );
}
