import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CircleAlert, Loader2, Send } from 'lucide-react';
import shellui from '@shellui/sdk';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { IdentityBackendMissing } from '@/components/ServiceUrlMissing';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { useShelluiAuthBackendBaseUrl } from '@/hooks/useShelluiAuthBackendBaseUrl';
import { AdminApiError, inviteAdminUser, type InviteLanguage } from '@/lib/adminUsersApi';
import { notifyInvitationsChanged, resolveShellAppUrl } from '@/lib/inviteModal';

const LANGUAGES: InviteLanguage[] = ['en', 'fr'];

function defaultLanguage(uiLanguage: string | undefined): InviteLanguage {
  return uiLanguage?.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

/** Invite form shown in a Shellui modal (`#/invite`, rendered without the admin chrome). */
export function InviteUserPage() {
  const { t, i18n } = useTranslation();
  const accessToken = useShelluiAccessToken();
  const authBackendBaseUrl = useShelluiAuthBackendBaseUrl();
  const rootRef = useRef<HTMLFormElement>(null);
  const [email, setEmail] = useState('');
  const [language, setLanguage] = useState<InviteLanguage>(() => defaultLanguage(i18n.language));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<{ message: string; tone: 'warning' | 'destructive' } | null>(
    null,
  );

  useEffect(() => shellui.overlay.autoSize({ target: rootRef.current }), []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const address = email.trim();
    if (!authBackendBaseUrl || !accessToken || !address || sending) return;
    setSending(true);
    setError(null);
    try {
      const appUrl = resolveShellAppUrl();
      await inviteAdminUser(accessToken, {
        email: address,
        language,
        ...(appUrl ? { app_url: appUrl } : {}),
      });
      notifyInvitationsChanged();
      shellui.toast({ title: t('inviteSent', { email: address }), type: 'success' });
      shellui.closeModal();
    } catch (e) {
      if (e instanceof AdminApiError && e.code === 'already_member') {
        setError({ message: t('inviteAlreadyMember', { email: address }), tone: 'warning' });
      } else if (e instanceof AdminApiError && e.code === 'already_invited') {
        setError({ message: t('inviteAlreadyInvited', { email: address }), tone: 'warning' });
      } else {
        setError({
          message: e instanceof Error ? e.message : t('usersErrorUnknown'),
          tone: 'destructive',
        });
      }
      setSending(false);
    }
  }

  return (
    <form
      ref={rootRef}
      onSubmit={(e) => void onSubmit(e)}
      className="space-y-5 bg-background p-6"
    >
      <header className="space-y-1.5">
        <h1 className="font-heading text-lg font-semibold tracking-tight">{t('inviteTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('inviteDescription')}</p>
      </header>

      {!authBackendBaseUrl ? (
        <IdentityBackendMissing />
      ) : !accessToken ? (
        <p className="text-sm text-muted-foreground">{t('usersNoSession')}</p>
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor="invite-email">{t('inviteEmailLabel')}</Label>
            <Input
              id="invite-email"
              type="email"
              required
              autoFocus
              autoComplete="off"
              value={email}
              aria-invalid={error ? true : undefined}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              placeholder={t('inviteEmailPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-language">{t('inviteLanguageLabel')}</Label>
            <select
              id="invite-language"
              value={language}
              onChange={(e) => setLanguage(e.target.value as InviteLanguage)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
            >
              {LANGUAGES.map((code) => (
                <option
                  key={code}
                  value={code}
                >
                  {t(`inviteLanguage_${code}`)}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">{t('inviteLanguageHint')}</p>
          </div>
        </>
      )}

      {error ? (
        <Alert variant={error.tone}>
          {error.tone === 'warning' ? <AlertTriangle aria-hidden /> : <CircleAlert aria-hidden />}
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => shellui.closeModal()}
        >
          {t('inviteCancel')}
        </Button>
        <Button
          type="submit"
          disabled={!authBackendBaseUrl || !accessToken || !email.trim() || sending}
          className="inline-flex items-center gap-2"
        >
          {sending ? (
            <>
              <Loader2
                className="size-4 animate-spin"
                aria-hidden
              />
              {t('inviteSending')}
            </>
          ) : (
            <>
              <Send
                className="size-4"
                aria-hidden
              />
              {t('inviteSend')}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
