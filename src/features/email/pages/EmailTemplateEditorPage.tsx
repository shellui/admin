import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Text } from '@/components/ui/text';
import { EmailCopyEditor } from '@/features/email/components/EmailCopyEditor';
import { useEmailApi } from '@/features/email/useEmailApi';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { getEmailFromJwt, getIsStaffFromJwt } from '@/lib/jwtCompany';
import type { EmailCatalogEvent, EmailTemplateRow } from '@/lib/emailTypes';
import { webhookRulesListPath } from '@/lib/webhookRoutePaths';
import { isWebhookServiceKey } from '@/lib/webhookServices';

/** An event email's copy, opened from a link. Rules edit the same copy inline. */
export function EmailTemplateEditorPage() {
  const { t } = useTranslation();
  const params = useParams();
  const templateId = Number(params.templateId);
  const accessToken = useShelluiAccessToken();
  const { api, baseUrl, canManage } = useEmailApi(accessToken);
  const [row, setRow] = useState<EmailTemplateRow | null>(null);
  const [event, setEvent] = useState<EmailCatalogEvent | null>(null);

  const title = row?.name || event?.label || t('emailEditorTitle');
  const laneLabel = event?.laneClass ? t(`emailLane_${event.laneClass}`, { defaultValue: '' }) : '';
  const service = event?.service && isWebhookServiceKey(event.service) ? event.service : null;

  return (
    <div className="w-full space-y-6">
      <header className="space-y-2">
        <Link
          to={service ? webhookRulesListPath(service) : '/email/templates'}
          className="font-mono text-xs text-primary underline-offset-2 hover:underline"
        >
          {service ? t('emailBackToRules') : t('emailBackToTemplates')}
        </Link>
        <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        {row?.eventType ? (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="text-muted-foreground">{t('emailEditorSentFor')}</span>
            {event?.label ? <span className="font-medium">{event.label}</span> : null}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              {row.eventType}
            </code>
            {laneLabel ? <Badge variant="outline">{laneLabel}</Badge> : null}
          </p>
        ) : null}
        <Text className="max-w-3xl">{t('emailEditorDescription')}</Text>
      </header>
      {!accessToken ? <Text>{t('dashboardNoSession')}</Text> : null}
      {accessToken && !canManage ? <Text>{t('emailForbidden')}</Text> : null}
      {api && canManage && Number.isFinite(templateId) ? (
        <EmailCopyEditor
          api={api}
          baseUrl={baseUrl}
          templateId={templateId}
          isStaff={Boolean(accessToken && getIsStaffFromJwt(accessToken))}
          jwtEmail={accessToken ? getEmailFromJwt(accessToken) : null}
          onLoaded={(nextRow, nextEvent) => {
            setRow(nextRow);
            setEvent(nextEvent);
          }}
        />
      ) : null}
    </div>
  );
}
