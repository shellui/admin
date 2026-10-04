import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown } from 'lucide-react';
import type { EmailTheme, EmailThemeColors } from '@/lib/emailThemes';
import { cn } from '@/lib/utils';

const COLUMNS = 3;

/** Every role, with the nearest stand-in for the ones a theme or design leaves out. */
function paint(colors: EmailThemeColors) {
  const background = colors.background ?? colors.card ?? '#ffffff';
  const card = colors.card ?? background;
  const foreground = colors.foreground ?? '#18181b';
  const muted = colors.muted ?? background;
  return {
    background,
    card,
    foreground,
    muted,
    mutedForeground: colors.muted_foreground ?? foreground,
    primary: colors.primary ?? foreground,
    primaryForeground: colors.primary_foreground ?? card,
    border: colors.border ?? muted,
  };
}

/** A tiny email in the theme's colors: page, card, heading, text, button, panel. */
function EmailThemePreview({ colors }: { colors: EmailThemeColors }) {
  const c = paint(colors);
  return (
    <div
      aria-hidden
      className="rounded-md border p-1.5"
      style={{ backgroundColor: c.background, borderColor: c.border }}
    >
      <div
        className="space-y-1 rounded-sm p-1.5"
        style={{ backgroundColor: c.card }}
      >
        <div
          className="h-1.5 w-3/5 rounded-full"
          style={{ backgroundColor: c.foreground }}
        />
        <div
          className="h-1 w-full rounded-full opacity-70"
          style={{ backgroundColor: c.mutedForeground }}
        />
        <div
          className="h-1 w-4/5 rounded-full opacity-70"
          style={{ backgroundColor: c.mutedForeground }}
        />
        <div
          className="flex h-2.5 w-9 items-center justify-center rounded-sm"
          style={{ backgroundColor: c.primary }}
        >
          <div
            className="h-0.5 w-5 rounded-full"
            style={{ backgroundColor: c.primaryForeground }}
          />
        </div>
        <div
          className="h-2 rounded-sm border"
          style={{ backgroundColor: c.muted, borderColor: c.border }}
        />
      </div>
    </div>
  );
}

function Dots({ colors }: { colors: EmailThemeColors }) {
  const c = paint(colors);
  return (
    <span
      aria-hidden
      className="flex -space-x-1"
    >
      {[c.background, c.primary, c.foreground].map((color, index) => (
        <span
          key={index}
          className="size-3 rounded-full ring-1 ring-border"
          style={{ backgroundColor: color }}
        />
      ))}
    </span>
  );
}

type Choice = { key: string; label: string; colors: EmailThemeColors; theme: EmailTheme | null };

/** Repaints a library design with a Shellui theme, or keeps its own colors. */
export function EmailThemeSelect({
  value,
  themes,
  designColors,
  onChange,
}: {
  value: EmailTheme | null;
  themes: EmailTheme[];
  /** The design's own colors, for the "Template colors" choice. */
  designColors: EmailThemeColors;
  onChange: (theme: EmailTheme | null) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listId = useId();

  const listed =
    value && !themes.some((theme) => theme.name === value.name) ? [value, ...themes] : themes;
  const choices: Choice[] = [
    { key: '', label: t('emailThemeTemplate'), colors: designColors, theme: null },
    ...listed.map((theme) => ({
      key: theme.name,
      label: theme.label,
      colors: theme.colors,
      theme,
    })),
  ];
  const selected = Math.max(
    0,
    choices.findIndex((choice) => choice.key === (value?.name ?? '')),
  );

  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  useEffect(() => {
    if (!open) return;
    optionRefs.current[selectedRef.current]?.focus();
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  function closeMenu() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function pick(choice: Choice) {
    onChange(choice.theme);
    closeMenu();
  }

  function moveFocus(event: KeyboardEvent<HTMLDivElement>) {
    const current = optionRefs.current.indexOf(document.activeElement as HTMLButtonElement);
    const last = choices.length - 1;
    const steps: Record<string, number> = {
      ArrowRight: current + 1,
      ArrowLeft: current - 1,
      ArrowDown: current + COLUMNS,
      ArrowUp: current - COLUMNS,
      Home: 0,
      End: last,
    };
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
    } else if (event.key === 'Tab') {
      setOpen(false);
    } else if (event.key in steps) {
      event.preventDefault();
      optionRefs.current[Math.min(last, Math.max(0, steps[event.key]))]?.focus();
    }
  }

  const current = choices[selected];

  return (
    <div
      ref={rootRef}
      className="relative"
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={t('emailTheme')}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        title={t('emailThemeHint')}
        className={cn(
          'inline-flex h-8 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          open && 'bg-muted/60 text-foreground',
        )}
        onClick={() => setOpen((was) => !was)}
      >
        <Dots colors={current.colors} />
        <span className="max-w-[11rem] truncate">{current.label}</span>
        <ChevronDown
          aria-hidden
          className={cn('size-3.5 opacity-70 transition-transform', open && 'rotate-180')}
        />
      </button>
      {open ? (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-[26rem] max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-lg"
          onKeyDown={moveFocus}
        >
          <p className="px-0.5 pb-2.5 text-xs text-muted-foreground">{t('emailThemeHint')}</p>
          <div
            id={listId}
            role="listbox"
            aria-label={t('emailTheme')}
            className="-m-1 grid max-h-[22rem] grid-cols-3 gap-2.5 overflow-y-auto p-1"
          >
            {choices.map((choice, index) => {
              const isSelected = index === selected;
              return (
                <button
                  key={choice.key || 'template'}
                  ref={(element) => {
                    optionRefs.current[index] = element;
                  }}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={cn(
                    'group min-w-0 rounded-lg p-1 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isSelected ? 'bg-muted' : 'hover:bg-muted/60',
                  )}
                  onClick={() => pick(choice)}
                >
                  <div
                    className={cn(
                      'rounded-md ring-offset-2 ring-offset-popover transition-shadow',
                      isSelected
                        ? 'ring-2 ring-primary'
                        : 'group-hover:ring-1 group-hover:ring-border',
                    )}
                  >
                    <EmailThemePreview colors={choice.colors} />
                  </div>
                  <span className="mt-1.5 flex items-center gap-1 px-0.5 text-xs">
                    <span className={cn('truncate', isSelected && 'font-medium')}>
                      {choice.label}
                    </span>
                    {isSelected ? (
                      <Check
                        aria-hidden
                        className="size-3 shrink-0 text-primary"
                      />
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
