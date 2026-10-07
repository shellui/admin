import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { PluginKey } from '@tiptap/pm/state';
import { useEditorState, type Editor } from '@tiptap/react';
import { BubbleMenu, bubbleMenuTriggers } from '@react-email/editor/ui';
import { AlignCenter, AlignLeft, AlignRight, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ASSETS_TOKEN } from '@/lib/emailDocument';
import { cn } from '@/lib/utils';

const IMAGE_MENU_KEY = new PluginKey('shelluiImageMenu');
const BARE_DOMAIN = /^[\w-]+(\.[\w-]+)+(\/\S*)?$/;
const IMAGE_ALIGNS = [
  { value: 'left', icon: AlignLeft, label: 'emailAlignLeft' },
  { value: 'center', icon: AlignCenter, label: 'emailAlignCenter' },
  { value: 'right', icon: AlignRight, label: 'emailAlignRight' },
] as const;
type ImageAlign = (typeof IMAGE_ALIGNS)[number]['value'];

/**
 * email-service keeps https images and library assets only. Library assets show
 * with the service URL while editing; bare domains get https.
 */
export function normalizeImageSrc(value: string, assetsUrl: string): string | null {
  const src = value.trim();
  if (!src) return '';
  if (assetsUrl && src.startsWith(`${assetsUrl}/`)) return src;
  if (src.startsWith(`${ASSETS_TOKEN}/`)) {
    return assetsUrl ? `${assetsUrl}${src.slice(ASSETS_TOKEN.length)}` : src;
  }
  if (/^https:\/\/\S+$/i.test(src)) return src;
  if (BARE_DOMAIN.test(src)) return `https://${src}`;
  return null;
}

function widthText(value: unknown): string {
  if (typeof value === 'number') return String(value);
  return typeof value === 'string' && /^\d+$/.test(value) ? value : '';
}

function imageAlign(value: unknown): ImageAlign {
  return value === 'center' || value === 'right' ? value : 'left';
}

type ImageField = 'src' | 'href' | 'width';

function ImageForm({
  editor,
  attrs,
  validateLink,
  assetsUrl,
}: {
  editor: Editor;
  attrs: Record<string, unknown>;
  validateLink: (value: string) => string | null;
  assetsUrl: string;
}) {
  const { t } = useTranslation();
  const id = useId();
  const initialWidth = widthText(attrs.width);
  const [src, setSrc] = useState(typeof attrs.src === 'string' ? attrs.src : '');
  const [alt, setAlt] = useState(typeof attrs.alt === 'string' ? attrs.alt : '');
  const [width, setWidth] = useState(initialWidth);
  const [href, setHref] = useState(typeof attrs.href === 'string' ? attrs.href : '');
  const [align, setAlign] = useState<ImageAlign>(imageAlign(attrs.alignment));
  const [error, setError] = useState<ImageField | null>(null);
  const srcInput = useRef<HTMLInputElement>(null);

  // The menu stays hidden until it is positioned, and hidden fields refuse focus.
  useEffect(() => {
    if (attrs.src) return;
    let frame = 0;
    let tries = 0;
    const focusSrc = () => {
      srcInput.current?.focus();
      if (document.activeElement !== srcInput.current && ++tries < 30) {
        frame = requestAnimationFrame(focusSrc);
      }
    };
    frame = requestAnimationFrame(focusSrc);
    return () => cancelAnimationFrame(frame);
  }, [attrs.src]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const nextSrc = normalizeImageSrc(src, assetsUrl);
    if (nextSrc === null) return setError('src');
    const nextHref = href.trim() ? validateLink(href) : null;
    if (href.trim() && !nextHref) return setError('href');
    const nextWidth = width.trim();
    if (nextWidth && !/^\d+$/.test(nextWidth)) return setError('width');
    setError(null);
    editor
      .chain()
      .focus()
      .updateAttributes('image', {
        src: nextSrc,
        alt: alt.trim(),
        href: nextHref,
        alignment: align === 'left' ? null : align,
        ...(nextWidth !== initialWidth
          ? { width: nextWidth ? Number(nextWidth) : 'auto', height: 'auto' }
          : {}),
      })
      .run();
  }

  // Clicks on labels and buttons must not blur the editor, or the menu closes.
  function keepEditorFocus(event: MouseEvent) {
    if (!(event.target instanceof HTMLInputElement)) event.preventDefault();
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      editor.commands.focus();
    }
  }

  const errorText: Record<ImageField, string> = {
    src: t('emailImageUrlInvalid'),
    href: t('emailImageLinkInvalid'),
    width: t('emailImageWidthInvalid'),
  };

  return (
    <form
      className="grid gap-2 text-left"
      onSubmit={submit}
      onMouseDown={keepEditorFocus}
      onKeyDown={onKeyDown}
      aria-label={t('emailBlock_image')}
    >
      <div className="grid gap-1">
        <Label htmlFor={`${id}-src`}>{t('emailImageUrl')}</Label>
        <Input
          id={`${id}-src`}
          value={src}
          ref={srcInput}
          placeholder="https://…"
          aria-invalid={error === 'src' || undefined}
          onChange={(event) => setSrc(event.target.value)}
        />
      </div>
      <div className="grid grid-cols-[1fr_6rem] gap-2">
        <div className="grid gap-1">
          <Label htmlFor={`${id}-alt`}>{t('emailImageAlt')}</Label>
          <Input
            id={`${id}-alt`}
            value={alt}
            onChange={(event) => setAlt(event.target.value)}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`${id}-width`}>{t('emailImageWidth')}</Label>
          <Input
            id={`${id}-width`}
            value={width}
            inputMode="numeric"
            placeholder={t('emailImageWidthAuto')}
            aria-invalid={error === 'width' || undefined}
            onChange={(event) => setWidth(event.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-1">
        <Label htmlFor={`${id}-href`}>{t('emailImageLink')}</Label>
        <Input
          id={`${id}-href`}
          value={href}
          placeholder="https://…"
          aria-invalid={error === 'href' || undefined}
          onChange={(event) => setHref(event.target.value)}
        />
      </div>
      {error ? (
        <p
          role="alert"
          className="text-xs text-destructive"
        >
          {errorText[error]}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-2 pt-1">
        <div
          role="group"
          aria-label={t('emailImageAlign')}
          className="flex gap-1"
        >
          {IMAGE_ALIGNS.map(({ value, icon: Icon, label }) => (
            <Button
              key={value}
              type="button"
              size="icon"
              variant="ghost"
              aria-label={t(label)}
              aria-pressed={align === value}
              className={cn('h-8 w-8', align === value && 'bg-accent text-accent-foreground')}
              onClick={() => setAlign(value)}
            >
              <Icon />
            </Button>
          ))}
        </div>
        <div className="flex gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-destructive"
            aria-label={t('emailImageRemove')}
            onClick={() => editor.chain().focus().deleteSelection().run()}
          >
            <Trash2 />
          </Button>
          <Button
            type="submit"
            size="sm"
          >
            {t('emailImageApply')}
          </Button>
        </div>
      </div>
    </form>
  );
}

type ImageMenuProps = {
  editor: Editor;
  assetsUrl: string;
  validateLink: (value: string) => string | null;
};

function SelectedImageForm({ editor, assetsUrl, validateLink }: ImageMenuProps) {
  const image = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      current?.isActive('image')
        ? {
            pos: current.state.selection.from,
            attrs: current.getAttributes('image') as Record<string, unknown>,
          }
        : null,
  });
  if (!image) return null;
  return (
    <ImageForm
      key={`${image.pos}:${JSON.stringify(image.attrs)}`}
      editor={editor}
      attrs={image.attrs}
      validateLink={validateLink}
      assetsUrl={assetsUrl}
    />
  );
}

const imageTrigger = bubbleMenuTriggers.node('image');

/** Edits the selected image: source URL, alt text, width, link, and alignment. */
export function EmailImageMenu(props: ImageMenuProps) {
  // Root renders the stock text menu when it has no children, so the child is always present.
  return (
    <BubbleMenu.Root
      trigger={imageTrigger}
      pluginKey={IMAGE_MENU_KEY}
      placement="top"
      className="email-image-menu"
    >
      <SelectedImageForm {...props} />
    </BubbleMenu.Root>
  );
}
