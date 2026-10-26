import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, Lock, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/admin/PageHeader';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useWebhookPageMeta } from '@/features/actions/useWebhookPageMeta';
import {
  ActionFeedback,
  feedbackFromError,
  type ActionFeedbackState,
} from '@/features/email/components/ActionFeedback';
import { EmailCopyEditor } from '@/features/email/components/EmailCopyEditor';
import { EmailLibraryGrid } from '@/features/email/components/EmailLibraryGrid';
import { SearchField } from '@/features/email/components/SearchField';
import { useEmailApi } from '@/features/email/useEmailApi';
import { useEmailThemes } from '@/features/email/useEmailThemes';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { getEmailFromJwt, getIsStaffFromJwt } from '@/lib/jwtCompany';
import { emailErrorText } from '@/lib/emailApiErrors';
import { emailAssetsUrl } from '@/lib/emailLibrary';
import { filterByQuery } from '@/lib/emailList';
import { parseStaticRecipientLines } from '@/lib/emailRules';
import { askShelluiConfirm } from '@/lib/shelluiConfirm';
import type { Newsletter } from '@/lib/emailNewsletters';
import type { EmailCatalogEvent, EmailLibrary, EmailRecipientMode } from '@/lib/emailTypes';
import { emailRuleEditPath, webhookRulesListPath } from '@/lib/webhookRoutePaths';

export function EmailRuleFormPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams();
  const ruleId = params.emailRuleId ? Number(params.emailRuleId) : null;
  const editing = ruleId != null && Number.isFinite(ruleId);
  const { service } = useWebhookPageMeta();
  const accessToken = useShelluiAccessToken();
  const { api, baseUrl, canManage } = useEmailApi(accessToken);
  const emailThemes = useEmailThemes();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [events, setEvents] = useState<EmailCatalogEvent[]>([]);
  const [library, setLibrary] = useState<EmailLibrary | null>(null);
  const [eventQuery, setEventQuery] = useState('');
  const [eventType, setEventType] = useState('');
  const [eventLabel, setEventLabel] = useState('');
  const [libraryId, setLibraryId] = useState<number | null>(null);
  const [designPicked, setDesignPicked] = useState(false);
  const [builtIn, setBuiltIn] = useState(false);
  const [recipientMode, setRecipientMode] = useState<EmailRecipientMode>('hints');
  const [addresses, setAddresses] = useState('');
  const [language, setLanguage] = useState('');
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [newsletterId, setNewsletterId] = useState<number | null>(null);
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const isNewsletterEvent = service.key === 'email' && eventType.startsWith('email.newsletter.');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState<ActionFeedbackState | null>(null);

  const load = useCallback(async () => {
    if (!api || !canManage) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const catalog = await api.fetchCatalog();
      setEvents(catalog.events.filter((event) => event.service === service.key));
      if (editing && ruleId != null) {
        const rule = await api.fetchRule(ruleId);
        const match = catalog.events.find((event) => event.eventType === rule.eventType);
        setEventType(rule.eventType);
        setEventLabel(match?.label || rule.eventType);
        setBuiltIn(rule.builtIn);
        setRecipientMode(rule.recipientMode);
        setAddresses(rule.staticRecipients.join('\n'));
        setLanguage(rule.language === 'en' || rule.language === 'fr' ? rule.language : '');
        setTemplateId(rule.templateId || null);
        setNewsletterId(rule.newsletterId);
      } else {
        setLibrary(await api.fetchLibrary());
      }
    } catch (error) {
      setLoadError(error);
    } finally {
      setLoading(false);
    }
  }, [api, canManage, editing, ruleId, service.key]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (service.key !== 'email' || !api || !canManage) return;
    let cancelled = false;
    api
      .fetchNewsletters()
      .then((rows) => {
        if (!cancelled) setNewsletters(rows);
      })
      .catch(() => {
        // The selector stays on "All newsletters" when the list cannot load.
      });
    return () => {
      cancelled = true;
    };
  }, [api, canManage, service.key]);

  const visibleEvents = useMemo(
    () => filterByQuery(events, eventQuery, (event) => `${event.label} ${event.eventType}`),
    [events, eventQuery],
  );

  function back() {
    navigate(webhookRulesListPath(service.key));
  }

  function pickEvent(item: EmailCatalogEvent) {
    setEventType(item.eventType);
    setEventLabel(item.label);
    const suggested = library?.templates.find((row) => row.key === item.defaultTemplate);
    if (!designPicked) setLibraryId(suggested?.id ?? null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!api || saving) return;
    setFeedback(null);
    if (!eventType) {
      setFeedback({ tone: 'error', text: t('emailRuleEventRequired') });
      return;
    }
    if (!editing && !libraryId) {
      setFeedback({ tone: 'error', text: t('emailRuleTemplateRequired') });
      return;
    }
    const staticRecipients = recipientMode === 'static' ? parseStaticRecipientLines(addresses) : [];
    setSaving(true);
    try {
      if (editing && ruleId != null) {
        await api.patchRule(ruleId, {
          recipient_mode: recipientMode,
          static_recipients: staticRecipients,
          language,
          ...(service.key === 'email'
            ? { newsletter_id: isNewsletterEvent ? newsletterId : null }
            : {}),
        });
        setFeedback({ tone: 'success', text: t('emailRuleSaved') });
        return;
      }
      const created = await api.createRule({
        event_type: eventType,
        service: service.key,
        enabled: true,
        language,
        recipient_mode: recipientMode,
        static_recipients: staticRecipients,
        ...(isNewsletterEvent && newsletterId != null ? { newsletter_id: newsletterId } : {}),
        content: {
          library_id: libraryId ?? 0,
          ...(emailThemes.current ? { theme: emailThemes.current } : {}),
        },
      });
      navigate(emailRuleEditPath(service.key, created.id), { replace: true });
    } catch (error) {
      setFeedback(feedbackFromError(t, error));
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!api || ruleId == null || builtIn || deleting) return;
    const confirmed = await askShelluiConfirm({
      title: t('emailRuleDeleteTitle'),
      description: t('emailRuleDeleteDescription'),
      okLabel: t('actionsDelete'),
      cancelLabel: t('actionsCancel'),
      mode: 'delete',
    });
    if (!confirmed) return;
    setDeleting(true);
    setFeedback(null);
    try {
      await api.deleteRule(ruleId);
      back();
    } catch (error) {
      setFeedback(feedbackFromError(t, error));
      setDeleting(false);
    }
  }

  const card =
    'space-y-3 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm';
  const ready = !loading && !loadError && api && canManage;

  return (
    <div className="w-full space-y-6">
      <PageHeader
        back={{ to: webhookRulesListPath(service.key), label: t('emailRuleBack') }}
        title={editing ? t('emailRuleEditTitle') : t('emailRuleCreateTitle')}
        service={t(service.badgeKey)}
        description={
          editing && eventType ? (
            <span className="font-mono text-xs">{eventType}</span>
          ) : (
            t('emailRuleFormDescription', { service: t(service.labelKey) })
          )
        }
        actions={
          ready && editing && !builtIn ? (
            <Button
              type="button"
              variant="destructive"
              disabled={deleting || saving}
              onClick={() => void onDelete()}
            >
              <Trash2 aria-hidden />
              {t('actionsDelete')}
            </Button>
          ) : ready && builtIn ? (
            <StatusBadge tone="muted">
              <Lock
                className="size-3"
                aria-hidden
              />
              {t('emailRuleBuiltInLocked')}
            </StatusBadge>
          ) : null
        }
      />

      {!accessToken ? (
        <Alert>
          <AlertDescription>{t('dashboardNoSession')}</AlertDescription>
        </Alert>
      ) : null}
      {accessToken && !canManage ? (
        <Alert variant="warning">
          <AlertDescription>{t('emailForbidden')}</AlertDescription>
        </Alert>
      ) : null}
      {loading ? (
        <div
          className="max-w-2xl space-y-3 rounded-xl border border-border bg-card p-5"
          aria-busy="true"
          aria-label={t('emailLoading')}
        >
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-2/3" />
        </div>
      ) : null}
      {loadError ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{emailErrorText(t, loadError)}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void load()}
            >
              {t('usersRetry')}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {ready ? (
        <form
          className="space-y-6"
          onSubmit={(event) => void onSubmit(event)}
        >
          <fieldset className={`max-w-2xl ${card}`}>
            <legend className="sr-only">{t('emailRuleEvent')}</legend>
            <p
              className="text-sm font-semibold"
              aria-hidden
            >
              {t('emailRuleEvent')}
            </p>
            {editing ? (
              <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3">
                <Lock
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-medium">{eventLabel}</p>
                  <p className="break-all font-mono text-xs text-muted-foreground">{eventType}</p>
                  <p className="text-xs text-muted-foreground">{t('emailRuleEventLocked')}</p>
                </div>
              </div>
            ) : (
              <>
                <SearchField
                  value={eventQuery}
                  onChange={setEventQuery}
                  label={t('emailRuleEventSearch')}
                  placeholder={t('emailRuleEventSearch')}
                />
                <div className="max-h-64 divide-y divide-border overflow-auto rounded-lg border border-border">
                  {visibleEvents.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">{t('emailEventsEmpty')}</p>
                  ) : (
                    visibleEvents.map((item) => (
                      <label
                        key={item.eventType}
                        className="flex cursor-pointer items-start gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-muted/50 has-[:checked]:bg-primary/10 motion-reduce:transition-none"
                      >
                        <input
                          type="radio"
                          name="event"
                          className="mt-1 accent-primary"
                          checked={eventType === item.eventType}
                          onChange={() => pickEvent(item)}
                        />
                        <span className="min-w-0">
                          <span className="block font-medium">{item.label}</span>
                          <span className="block break-all font-mono text-xs text-muted-foreground">
                            {item.eventType}
                          </span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </>
            )}

            {isNewsletterEvent ? (
              <div className="space-y-2 pt-1">
                <Label htmlFor="email-rule-newsletter">{t('webhooksNewsletterFilter')}</Label>
                <select
                  id="email-rule-newsletter"
                  className="flex h-9 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={newsletterId == null ? '' : String(newsletterId)}
                  onChange={(event) =>
                    setNewsletterId(event.target.value ? Number(event.target.value) : null)
                  }
                >
                  <option value="">{t('webhooksNewsletterFilterAll')}</option>
                  {newsletterId != null && !newsletters.some((row) => row.id === newsletterId) ? (
                    <option value={String(newsletterId)}>#{newsletterId}</option>
                  ) : null}
                  {newsletters.map((row) => (
                    <option
                      key={row.id}
                      value={String(row.id)}
                    >
                      {row.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  {t('emailRuleNewsletterFilterHint')}
                </p>
              </div>
            ) : null}
          </fieldset>

          {!editing && library ? (
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold">{t('emailRuleDesign')}</legend>
              <p className="max-w-3xl text-xs text-muted-foreground">{t('emailRuleDesignHint')}</p>
              <EmailLibraryGrid
                library={library}
                assetsUrl={emailAssetsUrl(baseUrl)}
                selectedId={libraryId}
                onSelect={(template) => {
                  setDesignPicked(true);
                  setLibraryId(template.id);
                }}
              />
            </fieldset>
          ) : null}

          <div className={`max-w-2xl ${card}`}>
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">{t('emailRuleRecipients')}</legend>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="recipients"
                  className="accent-primary"
                  checked={recipientMode === 'hints'}
                  onChange={() => setRecipientMode('hints')}
                />
                {t('emailRuleRecipientHints')}
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="recipients"
                  className="accent-primary"
                  checked={recipientMode === 'static'}
                  onChange={() => setRecipientMode('static')}
                />
                {t('emailRuleRecipientStatic')}
              </label>
              {recipientMode === 'static' ? (
                <div className="space-y-1 pt-1">
                  <textarea
                    aria-label={t('emailRuleAddresses')}
                    value={addresses}
                    onChange={(event) => setAddresses(event.target.value)}
                    rows={4}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <p className="text-xs text-muted-foreground">{t('emailRuleAddressesHint')}</p>
                </div>
              ) : null}
            </fieldset>

            <div className="space-y-2 border-t border-border pt-3">
              <Label htmlFor="email-rule-language">{t('emailRuleLanguage')}</Label>
              <select
                id="email-rule-language"
                className="flex h-9 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
              >
                <option value="">{t('emailRuleLanguageRecipient')}</option>
                <option value="en">{t('emailLangEn')}</option>
                <option value="fr">{t('emailLangFr')}</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <Button
              type="submit"
              disabled={saving || deleting}
            >
              {saving ? (
                <Loader2
                  className="animate-spin motion-reduce:animate-none"
                  aria-hidden
                />
              ) : null}
              {editing ? t('emailRuleSave') : t('emailRuleCreate')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={back}
            >
              {t('actionsCancel')}
            </Button>
            <ActionFeedback feedback={feedback} />
          </div>
        </form>
      ) : null}

      {ready && editing && templateId ? (
        <section
          className="space-y-3 border-t border-border pt-6"
          aria-label={t('emailRuleEmail')}
        >
          <h2 className="text-lg font-semibold tracking-tight">{t('emailRuleEmail')}</h2>
          <EmailCopyEditor
            api={api}
            baseUrl={baseUrl}
            templateId={templateId}
            isStaff={Boolean(accessToken && getIsStaffFromJwt(accessToken))}
            jwtEmail={accessToken ? getEmailFromJwt(accessToken) : null}
          />
        </section>
      ) : null}
    </div>
  );
}
