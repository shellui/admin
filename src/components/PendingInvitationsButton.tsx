import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MailQuestion } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { fetchAdminInvitations } from '@/lib/adminUsersApi';
import { onInvitationsChanged, openPendingInvitationsModal } from '@/lib/inviteModal';

type Props = {
  accessToken: string;
  size?: ButtonProps['size'];
  variant?: ButtonProps['variant'];
};

/** Opens the pending invitations modal; shows the pending count, including 0. */
export function PendingInvitationsButton({ accessToken, size, variant = 'outline' }: Props) {
  const { t } = useTranslation();
  const [count, setCount] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const rows = await fetchAdminInvitations(accessToken);
      setCount(rows.filter((row) => row.status === 'pending').length);
    } catch {
      setCount(null);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => onInvitationsChanged(() => void load()), [load]);

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      onClick={openPendingInvitationsModal}
      className="inline-flex shrink-0 items-center gap-2"
      aria-label={count == null ? t('invitationsButton') : t('invitationsButtonCount', { count })}
    >
      <MailQuestion
        className="size-4"
        aria-hidden
      />
      {t('invitationsButton')}
      <span
        className="min-w-5 rounded-full bg-muted px-1.5 text-center font-mono text-[11px] tabular-nums text-muted-foreground"
        aria-hidden
      >
        {count ?? '…'}
      </span>
    </Button>
  );
}
