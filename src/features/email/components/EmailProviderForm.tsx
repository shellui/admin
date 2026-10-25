import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { EmailApiError } from '@/lib/emailApiErrors';
import {
  ActionFeedback,
  feedbackFromError,
  type ActionFeedbackState,
} from '@/features/email/components/ActionFeedback';
import {
  EMAIL_PROVIDER_CATALOG,
  emailProviderDefinition,
  SES_DEFAULT_REGION,
  SES_REGIONS,
  validateSesDraft,
  type EmailProviderDefinition,
  type SesDraft,
} from '@/lib/emailProviders';
import type { EmailProviderSettings, EmailProviderWrite } from '@/lib/emailTypes';

type SmtpDraft = {
  host: string;
  port: string;
  username: string;
  useTls: boolean;
  useSsl: boolean;
};

const EMPTY_SMTP: SmtpDraft = { host: '', port: '587', username: '', useTls: true, useSsl: false };

const EMPTY_SES: SesDraft = { accessKeyId: '', region: SES_DEFAULT_REGION, configurationSet: '' };

const SES_OTHER_REGION = '__other__';

const SES_FIELDS = ['access_key_id', 'secret_access_key', 'region', 'configuration_set'] as const;

function providerOptionEnabled(
  item: EmailProviderDefinition,
  settings: EmailProviderSettings,
): boolean {
  if (!item.available) return false;
  if (item.id !== 'smtp') return true;
  return settings.smtpAllowed;
}

export function EmailProviderForm({
  settings,
  jwtEmail,
  isStaff,
  saving,
  testing,
  onSave,
  onTest,
}: {
  settings: EmailProviderSettings;
  jwtEmail: string | null;
  isStaff: boolean;
  saving: boolean;
  testing: boolean;
  onSave: (body: EmailProviderWrite) => Promise<void>;
  onTest: (to: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const initialDefinition = settings.provider
    ? emailProviderDefinition(settings.provider)
    : undefined;
  const initialProvider =
    settings.provider === 'smtp' ||
    (initialDefinition && providerOptionEnabled(initialDefinition, settings))
      ? (settings.provider ?? 'resend')
      : 'resend';
  const [provider, setProvider] = useState<string>(initialProvider);
  const [fromEmail, setFromEmail] = useState(settings.fromEmail);
  const [fromName, setFromName] = useState(settings.fromName);
  const [sendingDomain, setSendingDomain] = useState(settings.sendingDomain);
  const [bulkFromEmail, setBulkFromEmail] = useState(settings.bulkFromEmail);
  const [apiKey, setApiKey] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtp, setSmtp] = useState<SmtpDraft>(EMPTY_SMTP);
  const [ses, setSes] = useState<SesDraft>(EMPTY_SES);
  const [sesSecret, setSesSecret] = useState('');
  const [sesOtherRegion, setSesOtherRegion] = useState(false);
  const [sesErrors, setSesErrors] = useState<Record<string, string[]>>({});
  const [testTo, setTestTo] = useState(jwtEmail ?? '');
  const [saveFeedback, setSaveFeedback] = useState<ActionFeedbackState | null>(null);
  const [testFeedback, setTestFeedback] = useState<ActionFeedbackState | null>(null);

  useEffect(() => {
    setProvider(initialProvider);
    setFromEmail(settings.fromEmail);
    setFromName(settings.fromName);
    setSendingDomain(settings.sendingDomain);
    setBulkFromEmail(settings.bulkFromEmail);
  }, [
    initialProvider,
    settings.fromEmail,
    settings.fromName,
    settings.sendingDomain,
    settings.bulkFromEmail,
  ]);

  const definition = emailProviderDefinition(provider);
  const providerUnchanged = provider === (settings.provider ?? '');
  const hint = settings.credentialsHint;

  function clearSecrets() {
    setApiKey('');
    setSmtpPassword('');
    setSesSecret('');
  }

  const sesTouched =
    ses.accessKeyId.trim() !== '' ||
    ses.region.trim() !== SES_DEFAULT_REGION ||
    ses.configurationSet.trim() !== '' ||
    sesSecret.trim() !== '';

  function fieldErrorText(field: string): string {
    const codes = sesErrors[field];
    if (!codes?.length) return '';
    return codes
      .map((code) => {
        const key = `emailFieldError_${code}`;
        const label = t(key);
        return label === key ? code : label;
      })
      .join(', ');
  }

  async function submit() {
    setSaveFeedback(null);
    setSesErrors({});
    const kind = definition?.credentialKind;
    const secret =
      kind === 'smtp' ? smtpPassword.trim() : kind === 'ses' ? sesSecret.trim() : apiKey.trim();
    const providerChanged = !providerUnchanged || !settings.configured;
    if (kind === 'ses' && (providerChanged || sesTouched)) {
      const errors = validateSesDraft(ses, sesSecret);
      if (Object.keys(errors).length) {
        setSesErrors(errors);
        setSaveFeedback({ tone: 'error', text: t('emailSesFixFields') });
        return;
      }
    }
    if (providerChanged && !secret) {
      setSaveFeedback({ tone: 'error', text: t('emailCredentialsRequired') });
      return;
    }
    const body: EmailProviderWrite = {
      provider,
      from_email: fromEmail.trim(),
    };
    const fromNameNext = fromName.trim();
    const domainNext = sendingDomain.trim();
    const bulkNext = bulkFromEmail.trim();
    if (fromNameNext !== settings.fromName) body.from_name = fromNameNext;
    if (domainNext !== settings.sendingDomain) body.sending_domain = domainNext;
    if (bulkNext !== settings.bulkFromEmail) body.bulk_from_email = bulkNext;
    if (secret) {
      if (definition?.credentialKind === 'smtp') {
        body.credentials = {
          host: smtp.host.trim(),
          port: Number(smtp.port) || 587,
          username: smtp.username.trim(),
          password: smtpPassword,
          use_tls: smtp.useTls,
          use_ssl: smtp.useSsl,
        };
      } else if (definition?.credentialKind === 'ses') {
        const credentials: Record<string, string> = {
          access_key_id: ses.accessKeyId.trim(),
          secret_access_key: sesSecret.trim(),
          region: ses.region.trim(),
        };
        const configurationSet = ses.configurationSet.trim();
        if (configurationSet) credentials.configuration_set = configurationSet;
        body.credentials = credentials;
      } else {
        body.credentials = { api_key: apiKey };
      }
    }
    try {
      await onSave(body);
      clearSecrets();
      setSaveFeedback({ tone: 'success', text: t('emailProviderSaved') });
    } catch (err) {
      if (err instanceof EmailApiError) {
        const sesFieldErrors: Record<string, string[]> = {};
        for (const field of SES_FIELDS) {
          const codes = err.fieldErrors[field];
          if (codes?.length) sesFieldErrors[field] = codes;
        }
        setSesErrors(sesFieldErrors);
      }
      setSaveFeedback(feedbackFromError(t, err));
    }
  }

  async function sendTest() {
    setTestFeedback(null);
    try {
      await onTest((isStaff ? testTo : jwtEmail) ?? '');
      setTestFeedback({ tone: 'success', text: t('emailTestSent') });
    } catch (err) {
      setTestFeedback(feedbackFromError(t, err));
    }
  }

  return (
    <form
      className="space-y-6"
      onChange={() => {
        setSaveFeedback(null);
        setTestFeedback(null);
      }}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email-provider">{t('emailFieldProvider')}</Label>
          <select
            id="email-provider"
            className="flex h-9 w-full cursor-pointer rounded-md border border-input bg-transparent px-3 text-sm"
            value={provider}
            onChange={(event) => {
              setProvider(event.target.value);
              clearSecrets();
              setSesErrors({});
            }}
          >
            {EMAIL_PROVIDER_CATALOG.map((item) => {
              const enabled = providerOptionEnabled(item, settings);
              return (
                <option
                  key={item.id}
                  value={item.id}
                  disabled={!enabled}
                >
                  {t(`emailProvider_${item.id}`)}
                  {enabled ? '' : ` (${t('emailProviderUnavailable')})`}
                </option>
              );
            })}
          </select>
          {!settings.smtpAllowed ? (
            <Text className="font-mono text-xs">{t('emailSmtpDisabled')}</Text>
          ) : null}
          {settings.authLinkHosts.length ? (
            <Text className="font-mono text-xs">
              {t('emailAuthLinkHosts', { hosts: settings.authLinkHosts.join(', ') })}{' '}
              <a
                className="underline underline-offset-4"
                href="#/email/link-hosts"
              >
                {t('navEmailLinkHosts')}
              </a>
            </Text>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email-from">{t('emailFieldFromEmail')}</Label>
          <Input
            id="email-from"
            type="email"
            autoComplete="off"
            value={fromEmail}
            onChange={(event) => setFromEmail(event.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email-from-name">{t('emailFieldFromName')}</Label>
          <Input
            id="email-from-name"
            value={fromName}
            onChange={(event) => setFromName(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email-domain">{t('emailFieldSendingDomain')}</Label>
          <Input
            id="email-domain"
            value={sendingDomain}
            onChange={(event) => setSendingDomain(event.target.value)}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="email-bulk-from">{t('emailFieldBulkFrom')}</Label>
          <Input
            id="email-bulk-from"
            type="email"
            value={bulkFromEmail}
            onChange={(event) => setBulkFromEmail(event.target.value)}
          />
        </div>
      </div>

      {definition?.credentialKind === 'smtp' ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="email-smtp-host">{t('emailSmtpHost')}</Label>
            <Input
              id="email-smtp-host"
              value={smtp.host}
              onChange={(event) => setSmtp((prev) => ({ ...prev, host: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email-smtp-port">{t('emailSmtpPort')}</Label>
            <Input
              id="email-smtp-port"
              inputMode="numeric"
              value={smtp.port}
              onChange={(event) => setSmtp((prev) => ({ ...prev, port: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email-smtp-user">{t('emailSmtpUsername')}</Label>
            <Input
              id="email-smtp-user"
              autoComplete="off"
              value={smtp.username}
              onChange={(event) => setSmtp((prev) => ({ ...prev, username: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email-smtp-password">{t('emailSmtpPassword')}</Label>
            <Input
              id="email-smtp-password"
              name="smtpPassword"
              type="password"
              data-1p-ignore
              data-lpignore="true"
              autoComplete="new-password"
              value={smtpPassword}
              placeholder={t('emailSecretPlaceholder')}
              onChange={(event) => setSmtpPassword(event.target.value)}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="cursor-pointer"
              checked={smtp.useTls}
              onChange={(event) => setSmtp((prev) => ({ ...prev, useTls: event.target.checked }))}
            />
            {t('emailSmtpTls')}
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="cursor-pointer"
              checked={smtp.useSsl}
              onChange={(event) => setSmtp((prev) => ({ ...prev, useSsl: event.target.checked }))}
            />
            {t('emailSmtpSsl')}
          </label>
        </div>
      ) : definition?.credentialKind === 'ses' ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email-ses-access-key">{t('emailSesAccessKeyId')}</Label>
              <Input
                id="email-ses-access-key"
                autoComplete="off"
                spellCheck={false}
                value={ses.accessKeyId}
                aria-invalid={Boolean(sesErrors.access_key_id)}
                onChange={(event) =>
                  setSes((prev) => ({ ...prev, accessKeyId: event.target.value }))
                }
              />
              <SesFieldError text={fieldErrorText('access_key_id')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-ses-secret">{t('emailSesSecretAccessKey')}</Label>
              <Input
                id="email-ses-secret"
                name="sesSecretAccessKey"
                type="password"
                data-1p-ignore
                data-lpignore="true"
                autoComplete="new-password"
                value={sesSecret}
                placeholder={t('emailSecretPlaceholder')}
                aria-invalid={Boolean(sesErrors.secret_access_key)}
                onChange={(event) => setSesSecret(event.target.value)}
              />
              <SesFieldError text={fieldErrorText('secret_access_key')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-ses-region">{t('emailSesRegion')}</Label>
              <select
                id="email-ses-region"
                className="flex h-9 w-full cursor-pointer rounded-md border border-input bg-transparent px-3 text-sm"
                value={sesOtherRegion ? SES_OTHER_REGION : ses.region}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === SES_OTHER_REGION) {
                    setSesOtherRegion(true);
                    setSes((prev) => ({ ...prev, region: '' }));
                  } else {
                    setSesOtherRegion(false);
                    setSes((prev) => ({ ...prev, region: value }));
                  }
                }}
              >
                {SES_REGIONS.map((region) => (
                  <option
                    key={region}
                    value={region}
                  >
                    {region === SES_DEFAULT_REGION ? t('emailSesRegionZurich', { region }) : region}
                  </option>
                ))}
                <option value={SES_OTHER_REGION}>{t('emailSesRegionOther')}</option>
              </select>
              {sesOtherRegion ? (
                <Input
                  id="email-ses-region-other"
                  aria-label={t('emailSesRegionCustom')}
                  placeholder="ap-south-1"
                  autoComplete="off"
                  spellCheck={false}
                  value={ses.region}
                  aria-invalid={Boolean(sesErrors.region)}
                  onChange={(event) => setSes((prev) => ({ ...prev, region: event.target.value }))}
                />
              ) : null}
              <SesFieldError text={fieldErrorText('region')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-ses-config-set">{t('emailSesConfigurationSet')}</Label>
              <Input
                id="email-ses-config-set"
                autoComplete="off"
                spellCheck={false}
                value={ses.configurationSet}
                aria-invalid={Boolean(sesErrors.configuration_set)}
                onChange={(event) =>
                  setSes((prev) => ({ ...prev, configurationSet: event.target.value }))
                }
              />
              <SesFieldError text={fieldErrorText('configuration_set')} />
            </div>
          </div>
          <Text className="font-mono text-xs">
            {hint && providerUnchanged
              ? t('emailSesCredentialsHint', { hint })
              : t('emailCredentialsEmpty')}
          </Text>
          <Text className="text-xs">{t('emailSesBulkNote')}</Text>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="email-api-key">{t('emailFieldApiKey')}</Label>
          <Input
            id="email-api-key"
            name="apiKey"
            type="password"
            data-1p-ignore
            data-lpignore="true"
            autoComplete="new-password"
            value={apiKey}
            placeholder={t('emailSecretPlaceholder')}
            onChange={(event) => setApiKey(event.target.value)}
          />
          <Text className="font-mono text-xs">
            {hint ? t('emailCredentialsHint', { hint }) : t('emailCredentialsEmpty')}
          </Text>
        </div>
      )}

      {definition?.credentialKind === 'smtp' && hint ? (
        <Text className="font-mono text-xs">{t('emailCredentialsHint', { hint })}</Text>
      ) : null}

      <div className="space-y-2">
        <Button
          type="submit"
          disabled={saving}
        >
          {saving ? t('emailProviderSaving') : t('emailProviderSave')}
        </Button>
        <ActionFeedback feedback={saveFeedback} />
      </div>

      <div className="space-y-3 border-t border-border/80 pt-4">
        <h2 className="text-base font-semibold tracking-tight">{t('emailTestSend')}</h2>
        <Text>{isStaff ? t('emailTestStaffHint') : t('emailTestOwnerHint')}</Text>
        <div className="flex flex-wrap items-end gap-2">
          {isStaff ? (
            <div className="min-w-[16rem] flex-1 space-y-2">
              <Label htmlFor="email-test-to">{t('emailTestTo')}</Label>
              <Input
                id="email-test-to"
                type="email"
                value={testTo}
                onChange={(event) => setTestTo(event.target.value)}
              />
            </div>
          ) : null}
          <Button
            type="button"
            variant="outline"
            disabled={testing || !(isStaff ? testTo.trim() : jwtEmail)}
            onClick={() => void sendTest()}
          >
            {testing ? t('emailTestSending') : t('emailTestSend')}
          </Button>
        </div>
        <ActionFeedback feedback={testFeedback} />
      </div>
    </form>
  );
}

function SesFieldError({ text }: { text: string }) {
  if (!text) return null;
  return <Text className="font-mono text-xs text-destructive">{text}</Text>;
}
