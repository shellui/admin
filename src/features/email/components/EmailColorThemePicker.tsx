import { Check, ChevronDown } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { TEMPLATE_SPECS } from '@/features/email/templates/catalog';
import { usePopoverDismiss } from '@/hooks/usePopoverDismiss';
import {
  CUSTOM_COLORS,
  EMAIL_COLOR_THEMES,
  TEMPLATE_COLORS,
  type EmailPalette,
} from '@/lib/emailTheme';
import { cn } from '@/lib/utils';

type Swatch = { page: string; card: string; foreground: string; primary: string };

function paletteSwatch(palette: EmailPalette): Swatch {
  return {
    page: palette.muted,
    card: palette.background,
    foreground: palette.foreground,
    primary: palette.primary,
  };
}

/** A tiny email: page, card, a line of text, and the button color. */
function SwatchIcon({ swatch, small = false }: { swatch: Swatch; small?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border/60',
        small ? 'h-5 w-7' : 'h-7 w-10',
      )}
      style={{ backgroundColor: swatch.page }}
    >
      <span
        className={cn(
          'flex flex-col justify-center gap-0.5 rounded-[2px] px-1',
          small ? 'h-3.5 w-5' : 'h-5 w-7',
        )}
        style={{ backgroundColor: swatch.card }}
      >
        <span
          className="h-0.5 w-4 rounded-full"
          style={{ backgroundColor: swatch.foreground }}
        />
        <span
          className="h-1.5 w-3 rounded-[1px]"
          style={{ backgroundColor: swatch.primary }}
        />
      </span>
    </span>
  );
}

/** Theme dropdown for the editor toolbar: the current swatch, opening the color themes. */
export function EmailColorThemePicker({
  template,
  value,
  customPalette,
  note,
  onChange,
}: {
  template: string;
  value: string;
  /** Stored palette that matches no preset. Offered as "Saved colors". */
  customPalette: EmailPalette | null;
  note?: string;
  onChange: (key: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupId = useId();
  const spec = TEMPLATE_SPECS[template] ?? TEMPLATE_SPECS.barebone;
  const options: Array<{ key: string; swatch: Swatch }> = [
    {
      key: TEMPLATE_COLORS,
      swatch: {
        page: spec.page,
        card: spec.card,
        foreground: spec.foreground,
        primary: spec.button_bg,
      },
    },
    ...(customPalette ? [{ key: CUSTOM_COLORS, swatch: paletteSwatch(customPalette) }] : []),
    ...EMAIL_COLOR_THEMES.map((theme) => ({
      key: theme.key,
      swatch: paletteSwatch(theme.palette),
    })),
  ];
  const current = options.find((option) => option.key === value) ?? options[0];

  const close = useCallback(() => setOpen(false), []);
  usePopoverDismiss(open, close, rootRef, triggerRef);

  useEffect(() => {
    if (open) {
      rootRef.current?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')?.focus();
    }
  }, [open]);

  function moveFocus(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const radios = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]'));
    const index = radios.indexOf(document.activeElement as HTMLElement);
    const step = event.key === 'ArrowDown' ? 1 : -1;
    radios[(index + step + radios.length) % radios.length]?.focus();
  }

  function pick(key: string) {
    onChange(key);
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div
      ref={rootRef}
      className="relative"
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popupId : undefined}
        className="flex h-8 items-center gap-2 rounded-md border border-input bg-transparent pl-2 pr-1.5 text-sm transition-colors hover:bg-muted/40"
        onClick={() => setOpen((was) => !was)}
      >
        <span className="text-muted-foreground">{t('emailThemeLabel')}</span>
        <SwatchIcon
          swatch={current.swatch}
          small
        />
        <span className="max-w-[9rem] truncate">{t(`emailColorTheme_${current.key}`)}</span>
        <ChevronDown
          aria-hidden
          className={cn('size-4 text-muted-foreground transition-transform', open && 'rotate-180')}
        />
      </button>
      {open ? (
        <div
          id={popupId}
          role="dialog"
          aria-label={t('emailThemeLabel')}
          className="absolute right-0 top-full z-50 mt-1 w-64 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
        >
          <div
            role="radiogroup"
            aria-label={t('emailThemeLabel')}
            className="flex max-h-80 flex-col overflow-y-auto"
            onKeyDown={moveFocus}
          >
            {options.map((option) => {
              const selected = option.key === value;
              return (
                <button
                  key={option.key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  tabIndex={selected ? 0 : -1}
                  className={cn(
                    'flex items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted/60',
                    selected && 'font-medium',
                  )}
                  onClick={() => pick(option.key)}
                >
                  <SwatchIcon swatch={option.swatch} />
                  <span className="flex-1">{t(`emailColorTheme_${option.key}`)}</span>
                  {selected ? (
                    <Check
                      aria-hidden
                      className="size-4"
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
          {note ? (
            <p className="border-t border-border px-2 pb-1 pt-2 text-xs text-muted-foreground">
              {note}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
