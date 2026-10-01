import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Trash2 } from 'lucide-react';
import shellui from '@shellui/sdk';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import {
  deleteAdminInvitation,
  fetchAdminInvitations,
  inviteAdminUser,
  revokeAdminInvitation,
  type AdminInvitation,
} from '@/lib/adminUsersApi';
import { confirmAction } from '@/lib/confirmAction';
import { notifyInvitationsChanged, resolveShellAppUrl } from '@/lib/inviteModal';

/** Pending invitations list shown in a Shellui modal (`#/invitations`, without the admin chrome). */
export function PendingInvitationsPage() {
  const { t, i18n } = useTranslation();
  const accessToken = useShelluiAccessToken();
  const rootRef = useRef<HTMLDivElement>(null);
  const [invitations, setInvitations] = useState<AdminInvitation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => shellui.overlay.autoSize({ target: rootRef.current }), []);

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      setInvitations(await fetchAdminInvitations(accessToken));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('usersErrorUnknown'));
    }
  }, [accessToken, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat(i18n.language || 'en', { dateStyle: 'medium' }).format(d);
  };

  async function revoke(invitation: AdminInvitation) {
    if (!accessToken || busyId != null) return;
    const confirmed = await confirmAction({
      title: t('invitationsRevokeConfirmTitle', { email: invitation.email }),
      description: t('invitationsRevokeConfirm', { email: invitation.email }),
      okLabel: t('invitationsRevoke'),
      cancelLabel: t('inviteCancel'),
      danger: true,
    });
    if (!confirmed) return;
    setBusyId(invitation.id);
    try {
      const updated = await revokeAdminInvitation(accessToken, invitation.id);
      setInvitations((rows) => rows?.map((row) => (row.id === updated.id ? updated : row)) ?? rows);
      notifyInvitationsChanged();
      shellui.toast({
        title: t('invitationsRevoked', { email: invitation.email }),
        type: 'success',
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : t('usersErrorUnknown'));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(invitation: AdminInvitation) {
    if (!accessToken || busyId != null) return;
    const confirmed = await confirmAction({
      title: t('invitationsDeleteConfirmTitle', { email: invitation.email }),
      description: t('invitationsDeleteConfirm', { email: invitation.email }),
      okLabel: t('invitationsDelete'),
      cancelLabel: t('inviteCancel'),
      danger: true,
    });
    if (!confirmed) return;
    setBusyId(invitation.id);
    try {
      await deleteAdminInvitation(accessToken, invitation.id);
      setInvitations((rows) => rows?.filter((row) => row.id !== invitation.id) ?? rows);
      notifyInvitationsChanged();
      shellui.toast({
        title: t('invitationsDeleted', { email: invitation.email }),
        type: 'success',
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : t('usersErrorUnknown'));
    } finally {
      setBusyId(null);
    }
  }

  async function inviteAgain(invitation: AdminInvitation) {
    if (!accessToken || busyId != null) return;
    setBusyId(invitation.id);
    try {
      const appUrl = resolveShellAppUrl();
      await inviteAdminUser(accessToken, {
        email: invitation.email,
        language: invitation.language,
        ...(appUrl ? { app_url: appUrl } : {}),
      });
      notifyInvitationsChanged();
      shellui.toast({ title: t('inviteSent', { email: invitation.email }), type: 'success' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('usersErrorUnknown'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div
      ref={rootRef}
      className="space-y-5 overflow-hidden bg-background p-6"
    >
      <header className="space-y-1.5">
        <h1 className="font-heading text-lg font-semibold tracking-tight">
          {t('invitationsTitle')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('invitationsDescription')}</p>
      </header>

      {!accessToken ? <p className="text-sm text-muted-foreground">{t('usersNoSession')}</p> : null}

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      {accessToken && invitations == null && !error ? (
        <div className="flex justify-center py-6">
          <Loader2
            className="size-5 animate-spin text-muted-foreground"
            aria-hidden
          />
          <span className="sr-only">{t('usersLoading')}</span>
        </div>
      ) : null}

      {invitations && invitations.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
          {t('invitationsEmpty')}
        </p>
      ) : null}

      {invitations && invitations.length > 0 ? (
        <ul className="max-h-[60vh] divide-y divide-border overflow-y-auto rounded-md border border-border">
          {invitations.map((invitation) => {
            const revoked = invitation.status === 'revoked';
            return (
              <li
                key={invitation.id}
                className="flex items-center gap-3 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate font-mono text-sm"
                    title={invitation.email}
                  >
                    {invitation.email}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {t('invitationsRowMeta', {
                      language: t(`inviteLanguage_${invitation.language}`),
                      date: formatDate(invitation.created_at),
                      inviter: invitation.invited_by?.name ?? '—',
                    })}
                  </p>
                </div>
                <Badge
                  variant={revoked ? 'muted' : 'secondary'}
                  className="shrink-0 text-[10px]"
                >
                  {t(`invitationsStatus_${invitation.status}`)}
                </Badge>
                <Button
                  type="button"
                  variant={revoked ? 'outline' : 'ghost'}
                  size="sm"
                  disabled={busyId != null}
                  className={
                    revoked
                      ? 'h-7 shrink-0 text-xs'
                      : 'h-7 shrink-0 text-xs text-destructive hover:text-destructive'
                  }
                  onClick={() => void (revoked ? inviteAgain(invitation) : revoke(invitation))}
                >
                  {busyId === invitation.id ? (
                    <Loader2
                      className="size-3 animate-spin"
                      aria-hidden
                    />
                  ) : null}
                  {revoked ? t('invitationsInviteAgain') : t('invitationsRevoke')}
                </Button>
                {revoked ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busyId != null}
                    className="h-7 shrink-0 px-2 text-destructive hover:text-destructive"
                    aria-label={t('invitationsDeleteLabel', { email: invitation.email })}
                    title={t('invitationsDelete')}
                    onClick={() => void remove(invitation)}
                  >
                    <Trash2
                      className="size-3.5"
                      aria-hidden
                    />
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          onClick={() => shellui.closeModal()}
        >
          {t('invitationsClose')}
        </Button>
      </div>

      {/* Content-sized modals take the width autoSize reports (scrollWidth includes clipped
          overflow); the shell caps it to the viewport, and visible content fills what it grants. */}
      <div
        aria-hidden
        className="!mt-0 h-0 w-[46rem]"
      />
    </div>
  );
}
