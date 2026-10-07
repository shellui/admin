import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePopoverDismiss } from '@/hooks/usePopoverDismiss';
import { cn } from '@/lib/utils';

/**
 * "Send this draft" for the editor action row. Opens a small panel to confirm the
 * recipient: staff type it, a company owner always gets the session address.
 */
export function EmailSendDraftAction({
  isStaff,
  jwtEmail,
  to,
  sending,
  onToChange,
  onSend,
}: {
  isStaff: boolean;
  jwtEmail: string | null;
  to: string;
  sending: boolean;
  onToChange: (value: string) => void;
  onSend: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelId = useId();
  const inputId = useId();
  const close = useCallback(() => setOpen(false), []);
  usePopoverDismiss(open, close, rootRef, triggerRef);

  useEffect(() => {
    if (!open) return;
    if (inputRef.current) inputRef.current.focus();
    else rootRef.current?.querySelector<HTMLElement>('button[type="submit"]')?.focus();
  }, [open]);

  const canSend = !sending && (isStaff ? Boolean(to.trim()) : true);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSend) return;
    setOpen(false);
    triggerRef.current?.focus();
    onSend();
  }

  return (
    <div
      ref={rootRef}
      className="relative"
    >
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        disabled={sending}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((was) => !was)}
      >
        <Send aria-hidden />
        {sending ? t('emailTestSending') : t('emailSendDraft')}
        <ChevronDown
          aria-hidden
          className={cn('text-muted-foreground transition-transform', open && 'rotate-180')}
        />
      </Button>
      {open ? (
        <form
          id={panelId}
          role="dialog"
          aria-label={t('emailSendDraft')}
          className="absolute left-0 top-full z-50 mt-1 w-80 max-w-[calc(100vw-2rem)] space-y-3 rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-md"
          onSubmit={submit}
        >
          {isStaff ? (
            <div className="space-y-1.5">
              <Label htmlFor={inputId}>{t('emailTestTo')}</Label>
              <Input
                ref={inputRef}
                id={inputId}
                type="email"
                value={to}
                onChange={(event) => onToChange(event.target.value)}
              />
            </div>
          ) : jwtEmail ? (
            <p className="text-sm font-medium">{t('emailSendDraftTo', { email: jwtEmail })}</p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {isStaff ? t('emailSendDraftStaffHint') : t('emailSendDraftOwnerHint')}
          </p>
          <div className="flex justify-end">
            <Button
              type="submit"
              size="sm"
              disabled={!canSend}
            >
              {t('emailSendDraftConfirm')}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
