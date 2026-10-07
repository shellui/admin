import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
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

  return (
    <div className="w-full space-y-6">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
          {editing ? t('emailRuleEditTitle') : t('emailRuleCreateTitle')}
        </h1>
      </header>

      {!accessToken ? <Text>{t('dashboardNoSession')}</Text> : null}
      {accessToken && !canManage ? <Text>{t('emailForbidden')}</Text> : null}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t('emailLoading')}
        </div>
      ) : null}
      {loadError ? (
        <Text className="font-mono text-sm text-destructive">{emailErrorText(t, loadError)}</Text>
      ) : null}

      {!loading && !loadError && api && canManage ? (
        <form
          className="space-y-6"
          onSubmit={(event) => void onSubmit(event)}
        >
          <fieldset className="max-w-xl space-y-3">
            <legend className="text-sm font-medium">{t('emailRuleEvent')}</legend>
            {editing ? (
              <div className="space-y-1">
                <p className="text-sm">{eventLabel}</p>
                <p className="font-mono text-xs text-muted-foreground">{eventType}</p>
                <Text className="text-xs text-muted-foreground">{t('emailRuleEventLocked')}</Text>
              </div>
            ) : (
              <>
                <SearchField
                  value={eventQuery}
                  onChange={setEventQuery}
                  label={t('emailRuleEventSearch')}
                  placeholder={t('emailRuleEventSearch')}
                />
                <div className="max-h-64 space-y-2 overflow-auto rounded-md border border-border p-3">
                  {visibleEvents.length === 0 ? (
                    <Text className="text-sm text-muted-foreground">{t('emailEventsEmpty')}</Text>
                  ) : (
                    visibleEvents.map((item) => (
                      <label
                        key={item.eventType}
                        className="flex items-start gap-2 text-sm"
                      >
                        <input
                          type="radio"
                          name="event"
                          className="mt-1"
                          checked={eventType === item.eventType}
                          onChange={() => pickEvent(item)}
                        />
                        <span>
                          <span className="block">{item.label}</span>
                          <span className="block font-mono text-xs text-muted-foreground">
                            {item.eventType}
                          </span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </>
            )}
          </fieldset>

          {!editing && library ? (
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">{t('emailRuleDesign')}</legend>
              <Text className="max-w-3xl text-xs text-muted-foreground">
                {t('emailRuleDesignHint')}
              </Text>
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

          <fieldset className="max-w-xl space-y-2">
            <legend className="text-sm font-medium">{t('emailRuleRecipients')}</legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="recipients"
                checked={recipientMode === 'hints'}
                onChange={() => setRecipientMode('hints')}
              />
              {t('emailRuleRecipientHints')}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="recipients"
                checked={recipientMode === 'static'}
                onChange={() => setRecipientMode('static')}
              />
              {t('emailRuleRecipientStatic')}
            </label>
            {recipientMode === 'static' ? (
              <textarea
                aria-label={t('emailRuleAddresses')}
                value={addresses}
                onChange={(event) => setAddresses(event.target.value)}
                rows={4}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            ) : null}
          </fieldset>

          <div className="max-w-xl space-y-2">
            <Label htmlFor="email-rule-language">{t('emailRuleLanguage')}</Label>
            <select
              id="email-rule-language"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
            >
              <option value="">{t('emailRuleLanguageRecipient')}</option>
              <option value="en">{t('emailLangEn')}</option>
              <option value="fr">{t('emailLangFr')}</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {editing && !builtIn ? (
              <Button
                type="button"
                variant="destructive"
                disabled={deleting || saving}
                onClick={() => void onDelete()}
              >
                {t('actionsDelete')}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              onClick={back}
            >
              <ChevronLeft aria-hidden />
              {t('emailRuleBack')}
            </Button>
            <Button
              type="submit"
              disabled={saving || deleting}
            >
              {editing ? t('emailRuleSave') : t('emailRuleCreate')}
            </Button>
          </div>
          <ActionFeedback feedback={feedback} />
          {builtIn ? (
            <Text className="text-xs text-muted-foreground">{t('emailRuleBuiltInLocked')}</Text>
          ) : null}
        </form>
      ) : null}

      {!loading && !loadError && api && canManage && editing && templateId ? (
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
