import '@react-email/editor/themes/default.css';
import '@/features/email/editor/emailCanvas.css';
import { forwardRef, useImperativeHandle, useMemo, useRef, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { EditorContent, EditorContext, useEditor } from '@tiptap/react';
import { BubbleMenu, SlashCommand, type SlashCommandItem } from '@react-email/editor/ui';
import {
  Braces,
  Heading1,
  List,
  ListOrdered,
  Minus,
  MousePointerClick,
  PanelBottom,
  Pilcrow,
} from 'lucide-react';
import {
  formatEmailPlaceholder,
  safeHref,
  type EmailBlock,
  type EmailDocument,
  type EmailVariable,
} from '@/lib/emailDocument';
import type { EmailThemeKey } from '@/lib/emailTheme';
import { TEMPLATE_SPECS } from '@/features/email/templates/catalog';
import { canvasLayout, canvasVariables, fontFaceCss } from '@/features/email/editor/canvasTheme';
import { emailEditorExtensions } from '@/features/email/editor/extensions';
import { documentToTiptap, tiptapToDocument } from '@/features/email/editor/tiptapDocument';

export type EmailInlineEditorHandle = {
  /** Inserts text at the caret, or at the end when the editor never had focus. */
  insertText: (text: string) => void;
};

const BARE_DOMAIN = /^[\w-]+(\.[\w-]+)+(\/\S*)?$/;
const BARE_EMAIL = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;

/** Accepts https, http, mailto, tel, and `{{ url_token }}`. Bare domains get https. */
export function normalizeLink(value: string): string | null {
  const href = value.trim();
  if (!href) return null;
  if (safeHref(href)) return href;
  if (BARE_EMAIL.test(href)) return `mailto:${href}`;
  if (BARE_DOMAIN.test(href)) return `https://${href}`;
  return null;
}

const ICON = { size: 18 } as const;

export const EmailInlineEditor = forwardRef<
  EmailInlineEditorHandle,
  {
    /** Initial content. Remount the editor (change its `key`) to load another document. */
    document: EmailDocument;
    template: EmailThemeKey;
    palette: Record<string, string> | null;
    variables: EmailVariable[];
    label: string;
    onChange: (blocks: EmailBlock[]) => void;
    onFocus?: () => void;
  }
>(function EmailInlineEditor(
  { document, template, palette, variables, label, onChange, onFocus },
  ref,
) {
  const { t } = useTranslation();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onFocusRef = useRef(onFocus);
  onFocusRef.current = onFocus;
  const focusedOnce = useRef(false);

  const editor = useEditor({
    extensions: emailEditorExtensions({
      text: t('emailEditorPlaceholder'),
      heading: t('emailEditorPlaceholderHeading'),
      footer: t('emailEditorPlaceholderFooter'),
    }),
    content: documentToTiptap(document),
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': label,
        spellcheck: 'true',
      },
    },
    onUpdate: ({ editor: current }) => {
      onChangeRef.current(tiptapToDocument(current.getJSON(), '').blocks);
    },
    onFocus: () => {
      focusedOnce.current = true;
      onFocusRef.current?.();
    },
  });

  useImperativeHandle(
    ref,
    () => ({
      insertText(text: string) {
        if (!editor) return;
        editor
          .chain()
          .focus(focusedOnce.current ? undefined : 'end')
          .insertContent(text)
          .run();
      },
    }),
    [editor],
  );

  const spec = TEMPLATE_SPECS[template] ?? TEMPLATE_SPECS.barebone;
  const layout = canvasLayout(spec);
  const style = useMemo(() => canvasVariables(spec, palette), [spec, palette]);
  const fonts = useMemo(() => fontFaceCss(spec), [spec]);
  const contextValue = useMemo(() => ({ editor }), [editor]);

  const items = useMemo<SlashCommandItem[]>(() => {
    const blocks = t('emailSlashBlocks');
    const blockItems: SlashCommandItem[] = [
      {
        title: t('emailBlock_text'),
        description: t('emailSlash_text'),
        icon: <Pilcrow {...ICON} />,
        category: blocks,
        searchTerms: ['p', 'paragraph', 'text', 'texte'],
        command: ({ editor: e, range }) => {
          e.chain().focus().deleteRange(range).setNode('paragraph').run();
        },
      },
      {
        title: t('emailBlock_heading'),
        description: t('emailSlash_heading'),
        icon: <Heading1 {...ICON} />,
        category: blocks,
        searchTerms: ['h1', 'title', 'titre', 'heading'],
        command: ({ editor: e, range }) => {
          e.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run();
        },
      },
      {
        title: t('emailBlock_bulletList'),
        description: t('emailSlash_bulletList'),
        icon: <List {...ICON} />,
        category: blocks,
        searchTerms: ['ul', 'list', 'liste', 'bullet', 'puce'],
        command: ({ editor: e, range }) => {
          e.chain().focus().deleteRange(range).toggleBulletList().run();
        },
      },
      {
        title: t('emailBlock_orderedList'),
        description: t('emailSlash_orderedList'),
        icon: <ListOrdered {...ICON} />,
        category: blocks,
        searchTerms: ['ol', 'numbered', 'numéro', 'list', 'liste'],
        command: ({ editor: e, range }) => {
          e.chain().focus().deleteRange(range).toggleOrderedList().run();
        },
      },
      {
        title: t('emailBlock_button'),
        description: t('emailSlash_button'),
        icon: <MousePointerClick {...ICON} />,
        category: blocks,
        searchTerms: ['button', 'bouton', 'cta', 'link', 'lien'],
        command: ({ editor: e, range }) => {
          e.chain()
            .focus()
            .deleteRange(range)
            .insertContent({
              type: 'button',
              attrs: { href: '' },
              content: [{ type: 'text', text: t('emailBlock_button') }],
            })
            .run();
        },
      },
      {
        title: t('emailBlock_divider'),
        description: t('emailSlash_divider'),
        icon: <Minus {...ICON} />,
        category: blocks,
        searchTerms: ['hr', 'divider', 'separator', 'séparateur', 'line'],
        command: ({ editor: e, range }) => {
          e.chain().focus().deleteRange(range).setHorizontalRule().run();
        },
      },
      {
        title: t('emailBlock_footer'),
        description: t('emailSlash_footer'),
        icon: <PanelBottom {...ICON} />,
        category: blocks,
        searchTerms: ['footer', 'pied', 'small', 'note'],
        command: ({ editor: e, range }) => {
          e.chain().focus().deleteRange(range).setNode('footer').run();
        },
      },
    ];
    const variableCategory = t('emailSlashVariables');
    const variableItems: SlashCommandItem[] = variables.map((variable) => ({
      title: variable.token,
      description: variable.description || variable.example,
      icon: <Braces {...ICON} />,
      category: variableCategory,
      searchTerms: [variable.token, ...variable.token.split(/[._]/)],
      command: ({ editor: e, range }) => {
        e.chain()
          .focus()
          .deleteRange(range)
          .insertContent(formatEmailPlaceholder(variable.token))
          .run();
      },
    }));
    return [...blockItems, ...variableItems];
  }, [t, variables]);

  function focusFromPadding(event: MouseEvent<HTMLDivElement>) {
    if (!editor || (event.target as HTMLElement).closest('.tiptap')) return;
    event.preventDefault();
    editor.commands.focus('end');
  }

  return (
    <EditorContext.Provider value={contextValue}>
      {fonts ? <style>{fonts}</style> : null}
      <div
        className="email-canvas"
        style={style}
        data-template={template}
        data-layout={layout}
      >
        <div className="email-canvas-card">
          {layout === 'studio' ? <div className="email-canvas-bar" /> : null}
          <div
            className="email-canvas-inner"
            onMouseDown={focusFromPadding}
          >
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>
      {editor ? (
        <>
          <BubbleMenu.Root
            placement="top"
            hideWhenActiveNodes={['button', 'horizontalRule']}
            hideWhenActiveMarks={['link']}
          >
            <BubbleMenu.ItemGroup>
              <BubbleMenu.Bold />
              <BubbleMenu.Italic />
              <BubbleMenu.Underline />
            </BubbleMenu.ItemGroup>
            <BubbleMenu.ItemGroup>
              <BubbleMenu.LinkSelector validateUrl={normalizeLink} />
            </BubbleMenu.ItemGroup>
          </BubbleMenu.Root>
          <BubbleMenu.LinkDefault validateUrl={normalizeLink} />
          <BubbleMenu.ButtonDefault validateUrl={normalizeLink} />
          <SlashCommand items={items} />
        </>
      ) : null}
    </EditorContext.Provider>
  );
});

export default EmailInlineEditor;
