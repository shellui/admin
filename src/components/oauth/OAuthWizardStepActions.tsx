import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  backLabel: string;
  onBack?: () => void;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  busy?: boolean;
  extraActions?: ReactNode;
};

export function OAuthWizardStepActions({
  backLabel,
  onBack,
  primaryLabel,
  onPrimary,
  primaryDisabled,
  busy,
  extraActions,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 pt-2">
      {onBack ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={onBack}
        >
          <ChevronLeft
            className="mr-1 h-4 w-4"
            aria-hidden
          />
          {backLabel}
        </Button>
      ) : null}
      <Button
        type="button"
        size="sm"
        disabled={busy || primaryDisabled}
        onClick={onPrimary}
      >
        {primaryLabel}
      </Button>
      {extraActions}
    </div>
  );
}
