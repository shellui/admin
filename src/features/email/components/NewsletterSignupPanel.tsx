import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SettingsSection } from '@/components/admin/SettingsSection';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import {
  ActionFeedback,
  feedbackFromError,
  type ActionFeedbackState,
} from '@/features/email/components/ActionFeedback';
import type { EmailApiClient } from '@/lib/emailApi';
import { EmailApiError, emailErrorText } from '@/lib/emailApiErrors';
import { newsletterFormSnippet, type Newsletter } from '@/lib/emailNewsletters';
import { askShelluiConfirm } from '@/lib/shelluiConfirm';

function CopyField({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  const { t } = useTranslation();
  const [state, setState] = useState<'idle' | 'done' | 'error'>('idle');

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState('done');
    } catch {
      setState('error');
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{label}</p>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => void copy()}
        >
          {state === 'done' ? t('emailNewsletterCopied') : t('emailNewsletterCopy')}
        </Button>
      </div>
      {multiline ? (
        <pre className="max-h-96 overflow-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
          {value}
        </pre>
      ) : (
        <Input
          readOnly
          value={value}
          aria-label={label}
          className="font-mono text-xs"
        />
      )}
      {state === 'error' ? (
        <Text className="font-mono text-xs text-destructive">{t('emailNewsletterCopyError')}</Text>
      ) : null}
    </div>
  );
}

/** What a website needs to collect sign-ups: the endpoint, a form to paste, and the key. */
export function NewsletterSignupPanel({
  api,
  newsletter,
  onChange,
}: {
  api: EmailApiClient;
  newsletter: Newsletter;
  onChange: (next: Newsletter) => void;
}) {
  const { t } = useTranslation();
  const [rotating, setRotating] = useState(false);
  const [feedback, setFeedback] = useState<ActionFeedbackState | null>(null);
  const sender = newsletter.sender;

  async function rotate() {
    const confirmed = await askShelluiConfirm({
      title: t('emailNewsletterRotateTitle'),
      description: t('emailNewsletterRotateDescription'),
      okLabel: t('emailNewsletterRotate'),
      cancelLabel: t('actionsCancel'),
    });
    if (!confirmed) return;
    setRotating(true);
    setFeedback(null);
    try {
      onChange(await api.rotateNewsletterKey(newsletter.id));
      setFeedback({ tone: 'success', text: t('emailNewsletterRotated') });
    } catch (err) {
      setFeedback(feedbackFromError(t, err));
    } finally {
      setRotating(false);
    }
  }

  return (
    <div className="space-y-6">
      {sender?.errorCode ? (
        <Alert variant="warning">
          <AlertDescription>
            {t('emailNewsletterSenderMissing')}{' '}
            {emailErrorText(t, new EmailApiError(sender.errorCode, 409))}{' '}
            <Link
              to="/email/provider"
              className="font-medium underline underline-offset-2"
            >
              {t('emailBroadcastOpenProvider')}
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}

      <SettingsSection
        title={t('emailNewsletterSignupTitle')}
        description={t('emailNewsletterSignupHint')}
        footerNote={
          newsletter.allowedOrigins.length
            ? t('emailNewsletterOriginsSet', { origins: newsletter.allowedOrigins.join(', ') })
            : t('emailNewsletterOriginsAny')
        }
      >
        <div className="space-y-4">
          <CopyField
            label={t('emailNewsletterSubscribeUrl')}
            value={newsletter.subscribeUrl}
          />
          <CopyField
            label={t('emailNewsletterSnippet')}
            value={newsletterFormSnippet(newsletter)}
            multiline
          />
          <p className="text-xs text-muted-foreground">
            {t('emailNewsletterCspHint', { origin: new URL(newsletter.subscribeUrl).origin })}
          </p>
        </div>
      </SettingsSection>

      <SettingsSection
        title={t('emailNewsletterKey')}
        description={t('emailNewsletterKeyHint')}
        footerNote={<ActionFeedback feedback={feedback} />}
        footerAction={
          <Button
            type="button"
            variant="outline"
            disabled={rotating}
            onClick={() => void rotate()}
          >
            {rotating ? (
              <Loader2 className="animate-spin motion-reduce:animate-none" />
            ) : (
              <RefreshCw aria-hidden />
            )}
            {t('emailNewsletterRotate')}
          </Button>
        }
      >
        <p className="break-all rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-sm">
          {newsletter.publicKey}
        </p>
      </SettingsSection>

      <SettingsSection
        title={t('emailNewsletterSendTitle')}
        description={t('emailNewsletterSendHint')}
      >
        <Button
          asChild
          variant="outline"
        >
          <Link to="/email/broadcasts">{t('emailNewsletterOpenBroadcasts')}</Link>
        </Button>
      </SettingsSection>
    </div>
  );
}
