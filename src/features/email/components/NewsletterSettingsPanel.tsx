import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import {
  ActionFeedback,
  feedbackFromError,
  type ActionFeedbackState,
} from '@/features/email/components/ActionFeedback';
import { SegmentedControl } from '@/features/email/components/SegmentedControl';
import type { EmailApiClient } from '@/lib/emailApi';
import { EmailApiError } from '@/lib/emailApiErrors';
import { EMAIL_LANGS } from '@/lib/emailTranslations';
import { parseOrigins, type Newsletter, type NewsletterWrite } from '@/lib/emailNewsletters';

const TEXTAREA =
  'min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

/** Name, language, where the form may live, where people land, and bot protection. */
export function NewsletterSettingsPanel({
  api,
  newsletter,
  onChange,
}: {
  api: EmailApiClient;
  newsletter: Newsletter;
  onChange: (next: Newsletter) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(newsletter.name);
  const [nameError, setNameError] = useState<string | null>(null);
  const [description, setDescription] = useState(newsletter.description);
  const [language, setLanguage] = useState(newsletter.defaultLanguage === 'fr' ? 'fr' : 'en');
  const [origins, setOrigins] = useState(newsletter.allowedOrigins.join('\n'));
  const [redirect, setRedirect] = useState(newsletter.confirmedRedirectUrl);
  const [siteKey, setSiteKey] = useState(newsletter.turnstileSiteKey);
  const [secret, setSecret] = useState('');
  const [clearSecret, setClearSecret] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<ActionFeedbackState | null>(null);
  const parsed = parseOrigins(origins);

  // The page header can rename the list too, so follow the saved name.
  useEffect(() => {
    setName(newsletter.name);
  }, [newsletter.name]);

  async function save(ev: FormEvent) {
    ev.preventDefault();
    if (busy || parsed.invalid.length) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError(t('emailNewsletterNameRequired'));
      setFeedback(null);
      return;
    }
    setNameError(null);
    const body: NewsletterWrite = {
      name: trimmedName,
      description: description.trim(),
      default_language: language,
      allowed_origins: parsed.origins,
      confirmed_redirect_url: redirect.trim(),
      turnstile_site_key: siteKey.trim(),
    };
    if (secret.trim()) body.turnstile_secret = secret.trim();
    else if (clearSecret) body.turnstile_secret = '';
    setBusy(true);
    setFeedback(null);
    try {
      const saved = await api.patchNewsletter(newsletter.id, body);
      onChange(saved);
      setName(saved.name);
      setOrigins(saved.allowedOrigins.join('\n'));
      setSecret('');
      setClearSecret(false);
      setFeedback({ tone: 'success', text: t('emailNewsletterSaved') });
    } catch (err) {
      if (err instanceof EmailApiError && err.fieldErrors.name?.length) {
        setNameError(t('emailNewsletterNameRequired'));
      } else {
        setFeedback(feedbackFromError(t, err));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="max-w-3xl overflow-hidden rounded-xl border border-border bg-card shadow-sm"
      onSubmit={(ev) => void save(ev)}
    >
      <div className="space-y-5 p-4 sm:p-5">
        <div className="space-y-1.5">
          <Label htmlFor="newsletter-name">{t('emailNewsletterName')}</Label>
          <Input
            id="newsletter-name"
            value={name}
            maxLength={120}
            placeholder={t('emailNewsletterNamePlaceholder')}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? 'newsletter-name-error' : 'newsletter-name-hint'}
            onChange={(ev) => {
              setName(ev.target.value);
              if (nameError && ev.target.value.trim()) setNameError(null);
            }}
          />
          {nameError ? (
            <Text
              id="newsletter-name-error"
              role="alert"
              className="text-xs text-destructive"
            >
              {nameError}
            </Text>
          ) : (
            <Text
              id="newsletter-name-hint"
              className="text-xs"
            >
              {t('emailNewsletterNameHint')}
            </Text>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="newsletter-description">{t('emailNewsletterDescription')}</Label>
          <Input
            id="newsletter-description"
            value={description}
            maxLength={500}
            placeholder={t('emailNewsletterDescriptionPlaceholder')}
            onChange={(ev) => setDescription(ev.target.value)}
          />
          <Text className="text-xs">{t('emailNewsletterDescriptionHint')}</Text>
        </div>

        <div className="space-y-1.5">
          <Label>{t('emailNewsletterLanguage')}</Label>
          <div>
            <SegmentedControl
              label={t('emailNewsletterLanguage')}
              value={language}
              options={EMAIL_LANGS.map((value) => ({
                value,
                label: t(`emailLangInline_${value}`),
              }))}
              onChange={setLanguage}
            />
          </div>
          <Text className="text-xs">{t('emailNewsletterLanguageHint')}</Text>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="newsletter-origins">{t('emailNewsletterOrigins')}</Label>
          <textarea
            id="newsletter-origins"
            className={TEXTAREA}
            value={origins}
            placeholder="https://www.example.com"
            onChange={(ev) => setOrigins(ev.target.value)}
          />
          <Text className="text-xs">{t('emailNewsletterOriginsHint')}</Text>
          {parsed.invalid.length ? (
            <Text className="text-xs text-destructive">
              {t('emailNewsletterOriginsInvalid', {
                origins: parsed.invalid.slice(0, 5).join(', '),
              })}
            </Text>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="newsletter-redirect">{t('emailNewsletterRedirect')}</Label>
          <Input
            id="newsletter-redirect"
            type="url"
            value={redirect}
            placeholder="https://www.example.com/newsletter/confirmed/"
            onChange={(ev) => setRedirect(ev.target.value)}
          />
          <Text className="text-xs">{t('emailNewsletterRedirectHint')}</Text>
        </div>

        <fieldset className="space-y-3">
          <legend className="w-full border-t border-border pt-5 text-sm font-medium">
            {t('emailNewsletterTurnstile')}
          </legend>
          <Text className="text-xs">{t('emailNewsletterTurnstileHint')}</Text>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="newsletter-site-key">{t('emailNewsletterSiteKey')}</Label>
              <Input
                id="newsletter-site-key"
                value={siteKey}
                className="font-mono text-xs"
                onChange={(ev) => setSiteKey(ev.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newsletter-secret">{t('emailNewsletterSecret')}</Label>
              <Input
                id="newsletter-secret"
                type="password"
                data-1p-ignore
                data-lpignore="true"
                autoComplete="off"
                value={secret}
                className="font-mono text-xs"
                placeholder={
                  newsletter.turnstileConfigured ? t('emailNewsletterSecretSaved') : undefined
                }
                onChange={(ev) => setSecret(ev.target.value)}
              />
            </div>
          </div>
          {newsletter.turnstileConfigured ? (
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 rounded border"
                checked={clearSecret}
                onChange={(ev) => setClearSecret(ev.target.checked)}
              />
              {t('emailNewsletterSecretClear')}
            </label>
          ) : null}
        </fieldset>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border bg-muted/30 px-4 py-3 sm:px-5">
        <ActionFeedback feedback={feedback} />
        <Button
          type="submit"
          disabled={busy || parsed.invalid.length > 0}
        >
          {busy ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : null}
          {t('emailNewsletterSave')}
        </Button>
      </div>
    </form>
  );
}
