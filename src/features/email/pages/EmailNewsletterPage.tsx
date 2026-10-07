import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import {
  ActionFeedback,
  feedbackFromError,
  type ActionFeedbackState,
} from '@/features/email/components/ActionFeedback';
import { EmailCopyEditor } from '@/features/email/components/EmailCopyEditor';
import { NewsletterSettingsPanel } from '@/features/email/components/NewsletterSettingsPanel';
import { NewsletterSignupPanel } from '@/features/email/components/NewsletterSignupPanel';
import { NewsletterSubscribersPanel } from '@/features/email/components/NewsletterSubscribersPanel';
import { SegmentedControl } from '@/features/email/components/SegmentedControl';
import { useEmailApi } from '@/features/email/useEmailApi';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { confirmAction } from '@/lib/confirmAction';
import { emailErrorText } from '@/lib/emailApiErrors';
import type { Newsletter } from '@/lib/emailNewsletters';
import { getEmailFromJwt, getIsStaffFromJwt } from '@/lib/jwtCompany';

type Tab = 'subscribers' | 'signup' | 'confirmation' | 'settings';

export function EmailNewsletterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams();
  const newsletterId = Number(params.newsletterId);
  const accessToken = useShelluiAccessToken();
  const { api, baseUrl, canManage } = useEmailApi(accessToken);
  const [newsletter, setNewsletter] = useState<Newsletter | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [tab, setTab] = useState<Tab>('subscribers');
  const [name, setName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState<ActionFeedbackState | null>(null);

  const apply = useCallback((next: Newsletter) => {
    setNewsletter(next);
    setName(next.name);
  }, []);

  const reload = useCallback(async () => {
    if (!api || !canManage || !Number.isFinite(newsletterId)) return;
    try {
      apply(await api.fetchNewsletter(newsletterId));
    } catch (err) {
      setLoadError(err);
    }
  }, [api, canManage, newsletterId, apply]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function saveName() {
    if (!api || !newsletter) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === newsletter.name) {
      setName(newsletter.name);
      return;
    }
    try {
      apply(await api.patchNewsletter(newsletter.id, { name: trimmed }));
    } catch (err) {
      setFeedback(feedbackFromError(t, err));
      setName(newsletter.name);
    }
  }

  async function remove() {
    if (!api || !newsletter) return;
    const ok = await confirmAction({
      title: t('emailNewsletterDeleteTitle'),
      description: t('emailNewsletterDeleteDescription', {
        name: newsletter.name,
        count: newsletter.counts.confirmed,
      }),
      okLabel: t('emailNewsletterDelete'),
      cancelLabel: t('actionsCancel'),
      danger: true,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await api.deleteNewsletter(newsletter.id);
      navigate('/email/newsletters');
    } catch (err) {
      setFeedback(feedbackFromError(t, err));
      setDeleting(false);
    }
  }

  const tabs: Array<{ value: Tab; label: string }> = [
    { value: 'subscribers', label: t('emailNewsletterTabSubscribers') },
    { value: 'signup', label: t('emailNewsletterTabSignup') },
    { value: 'confirmation', label: t('emailNewsletterTabConfirmation') },
    { value: 'settings', label: t('emailNewsletterTabSettings') },
  ];

  return (
    <div className="w-full space-y-6">
      <header className="space-y-2">
        <Link
          to="/email/newsletters"
          className="font-mono text-xs text-primary underline-offset-2 hover:underline"
        >
          {t('emailNewsletterBack')}
        </Link>
        {newsletter ? (
          <Input
            aria-label={t('emailNewsletterName')}
            className="h-auto max-w-xl border-transparent px-1 font-heading text-2xl font-semibold tracking-tight shadow-none hover:border-input md:text-3xl"
            value={name}
            maxLength={120}
            onChange={(ev) => setName(ev.target.value)}
            onBlur={() => void saveName()}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter') ev.currentTarget.blur();
            }}
          />
        ) : (
          <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
            {t('emailNewslettersTitle')}
          </h1>
        )}
      </header>

      {!accessToken ? <Text>{t('dashboardNoSession')}</Text> : null}
      {accessToken && !canManage ? <Text>{t('emailForbidden')}</Text> : null}
      {loadError ? (
        <Text className="font-mono text-sm text-destructive">{emailErrorText(t, loadError)}</Text>
      ) : null}
      {!newsletter && !loadError && canManage ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t('emailLoading')}
        </div>
      ) : null}

      {newsletter && api && accessToken ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SegmentedControl
              label={t('emailNewslettersTitle')}
              value={tab}
              options={tabs}
              onChange={(next) => {
                setFeedback(null);
                setTab(next);
              }}
            />
            <Button
              type="button"
              variant="ghost"
              className="text-destructive"
              disabled={deleting}
              onClick={() => void remove()}
            >
              {t('emailNewsletterDelete')}
            </Button>
          </div>
          <ActionFeedback feedback={feedback} />

          {tab === 'subscribers' ? (
            <NewsletterSubscribersPanel
              api={api}
              newsletter={newsletter}
              onChanged={() => void reload()}
            />
          ) : null}
          {tab === 'signup' ? (
            <NewsletterSignupPanel
              api={api}
              newsletter={newsletter}
              onChange={apply}
            />
          ) : null}
          {tab === 'confirmation' ? (
            <div className="space-y-3">
              <Text className="max-w-3xl text-sm">{t('emailNewsletterConfirmationHint')}</Text>
              <EmailCopyEditor
                api={api}
                baseUrl={baseUrl}
                templateId={newsletter.confirmationTemplateId}
                isStaff={getIsStaffFromJwt(accessToken)}
                jwtEmail={getEmailFromJwt(accessToken)}
              />
            </div>
          ) : null}
          {tab === 'settings' ? (
            <NewsletterSettingsPanel
              api={api}
              newsletter={newsletter}
              onChange={apply}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
