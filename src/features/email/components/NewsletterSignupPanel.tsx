import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
    <div className="max-w-4xl space-y-5">
      {sender?.errorCode ? (
        <section className="rounded-lg border border-destructive/50 p-4">
          <Text className="text-sm text-destructive">
            {t('emailNewsletterSenderMissing')}{' '}
            {emailErrorText(t, new EmailApiError(sender.errorCode, 409))}{' '}
            <Link
              to="/email/provider"
              className="text-primary underline-offset-2 hover:underline"
            >
              {t('emailBroadcastOpenProvider')}
            </Link>
          </Text>
        </section>
      ) : null}

      <section className="space-y-4 rounded-lg border border-border bg-card p-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">{t('emailNewsletterSignupTitle')}</h2>
          <Text className="text-xs">{t('emailNewsletterSignupHint')}</Text>
        </div>
        <CopyField
          label={t('emailNewsletterSubscribeUrl')}
          value={newsletter.subscribeUrl}
        />
        <CopyField
          label={t('emailNewsletterSnippet')}
          value={newsletterFormSnippet(newsletter)}
          multiline
        />
        <Text className="text-xs">
          {t('emailNewsletterCspHint', { origin: new URL(newsletter.subscribeUrl).origin })}
        </Text>
        {newsletter.allowedOrigins.length ? (
          <Text className="text-xs">
            {t('emailNewsletterOriginsSet', { origins: newsletter.allowedOrigins.join(', ') })}
          </Text>
        ) : (
          <Text className="text-xs">{t('emailNewsletterOriginsAny')}</Text>
        )}
      </section>

      <section className="space-y-3 rounded-lg border border-border bg-card p-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">{t('emailNewsletterKey')}</h2>
          <Text className="text-xs">{t('emailNewsletterKeyHint')}</Text>
        </div>
        <p className="font-mono text-sm">{newsletter.publicKey}</p>
        <Button
          type="button"
          variant="outline"
          disabled={rotating}
          onClick={() => void rotate()}
        >
          {rotating ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          {t('emailNewsletterRotate')}
        </Button>
        <ActionFeedback feedback={feedback} />
      </section>

      <section className="space-y-1 rounded-lg border border-border p-4">
        <h2 className="text-sm font-semibold">{t('emailNewsletterSendTitle')}</h2>
        <Text className="text-xs">
          {t('emailNewsletterSendHint')}{' '}
          <Link
            to="/email/broadcasts"
            className="text-primary underline-offset-2 hover:underline"
          >
            {t('emailNewsletterOpenBroadcasts')}
          </Link>
        </Text>
      </section>
    </div>
  );
}
