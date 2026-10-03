import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import {
  ActionFeedback,
  feedbackFromError,
  type ActionFeedbackState,
} from '@/features/email/components/ActionFeedback';
import {
  EMAIL_PROVIDER_CATALOG,
  emailProviderDefinition,
  type EmailProviderDefinition,
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
  }

  async function submit() {
    setSaveFeedback(null);
    const secret = definition?.credentialKind === 'smtp' ? smtpPassword.trim() : apiKey.trim();
    const providerChanged = !providerUnchanged || !settings.configured;
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
      } else {
        body.credentials = { api_key: apiKey };
      }
    }
    try {
      await onSave(body);
      clearSecrets();
      setSaveFeedback({ tone: 'success', text: t('emailProviderSaved') });
    } catch (err) {
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
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            value={provider}
            onChange={(event) => {
              setProvider(event.target.value);
              clearSecrets();
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
              {t('emailAuthLinkHosts', { hosts: settings.authLinkHosts.join(', ') })}
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
              autoComplete="new-password"
              value={smtpPassword}
              placeholder={t('emailSecretPlaceholder')}
              onChange={(event) => setSmtpPassword(event.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={smtp.useTls}
              onChange={(event) => setSmtp((prev) => ({ ...prev, useTls: event.target.checked }))}
            />
            {t('emailSmtpTls')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={smtp.useSsl}
              onChange={(event) => setSmtp((prev) => ({ ...prev, useSsl: event.target.checked }))}
            />
            {t('emailSmtpSsl')}
          </label>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="email-api-key">{t('emailFieldApiKey')}</Label>
          <Input
            id="email-api-key"
            name="apiKey"
            type="password"
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
