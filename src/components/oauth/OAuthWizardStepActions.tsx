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
    <div className="-mx-4 -mb-4 mt-2 flex flex-wrap items-center gap-2 border-t border-border bg-muted/30 px-4 py-3 sm:-mx-5 sm:-mb-5 sm:px-5">
      {extraActions}
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {onBack ? (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onBack}
          >
            <ChevronLeft
              className="size-4"
              aria-hidden
            />
            {backLabel}
          </Button>
        ) : null}
        <Button
          type="button"
          disabled={busy || primaryDisabled}
          onClick={onPrimary}
        >
          {primaryLabel}
        </Button>
      </div>
    </div>
  );
}
