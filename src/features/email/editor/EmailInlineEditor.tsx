import '@react-email/editor/themes/default.css';
import '@/features/email/editor/emailCanvas.css';
import { forwardRef, useImperativeHandle, useMemo, useRef, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Schema } from '@tiptap/pm/model';
import { EditorContent, EditorContext, useEditor } from '@tiptap/react';
import { BubbleMenu, SlashCommand, type SlashCommandItem } from '@react-email/editor/ui';
import {
  Braces,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Minus,
  MousePointerClick,
  Pilcrow,
} from 'lucide-react';
import {
  formatEmailPlaceholder,
  safeHref,
  withAssetsUrl,
  withoutAssetsUrl,
  type EmailDocument,
  type EmailNode,
  type EmailVariable,
} from '@/lib/emailDocument';
import { scopeHeadCss } from '@/lib/emailHeadCss';
import { emailEditorExtensions } from '@/features/email/editor/extensions';

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

/** Drops attributes that hold their schema default, as the library seeds do. */
export function compactDocument(node: EmailNode, schema: Schema): EmailNode {
  const out: EmailNode = { type: node.type };
  const spec = (schema.nodes[node.type] ?? schema.marks[node.type])?.spec.attrs ?? {};
  if (node.attrs) {
    const attrs = Object.fromEntries(
      Object.entries(node.attrs).filter(([name, value]) => {
        const fallback = spec[name]?.default ?? null;
        return value !== fallback && !(value === '' && fallback === null);
      }),
    );
    if (Object.keys(attrs).length) out.attrs = attrs;
  }
  if (node.marks?.length) {
    out.marks = node.marks.map((mark) => compactDocument(mark as EmailNode, schema));
  }
  if (typeof node.text === 'string') out.text = node.text;
  if (node.content?.length)
    out.content = node.content.map((child) => compactDocument(child, schema));
  return out;
}

const ICON = { size: 18 } as const;
const CANVAS_SCOPE = '.email-canvas';

export const EmailInlineEditor = forwardRef<
  EmailInlineEditorHandle,
  {
    /** Initial content. Remount the editor (change its `key`) to load another document. */
    document: EmailDocument;
    /** Fonts and mobile rules of the design's set. */
    head: string;
    /** Service URL that `{{ system.assets_url }}` stands for while editing. */
    assetsUrl: string;
    variables: EmailVariable[];
    label: string;
    editable?: boolean;
    onChange: (document: EmailDocument) => void;
    onFocus?: () => void;
  }
>(function EmailInlineEditor(
  { document, head, assetsUrl, variables, label, editable = true, onChange, onFocus },
  ref,
) {
  const { t } = useTranslation();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onFocusRef = useRef(onFocus);
  onFocusRef.current = onFocus;
  const focusedOnce = useRef(false);

  const editor = useEditor({
    extensions: emailEditorExtensions({ head, placeholder: t('emailEditorPlaceholder') }),
    content: withAssetsUrl(document, assetsUrl),
    editable,
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': label,
        spellcheck: 'true',
      },
    },
    onUpdate: ({ editor: current }) => {
      const compact = compactDocument(current.getJSON() as EmailNode, current.schema);
      onChangeRef.current(withoutAssetsUrl(compact as EmailDocument, assetsUrl));
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

  const scopedHead = useMemo(() => scopeHeadCss(head, CANVAS_SCOPE), [head]);
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
        title: t('emailBlock_subheading'),
        description: t('emailSlash_subheading'),
        icon: <Heading2 {...ICON} />,
        category: blocks,
        searchTerms: ['h2', 'subtitle', 'sous-titre', 'heading'],
        command: ({ editor: e, range }) => {
          e.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run();
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
    if (!editor || !editable || (event.target as HTMLElement).closest('.tiptap')) return;
    event.preventDefault();
    editor.commands.focus('end');
  }

  return (
    <EditorContext.Provider value={contextValue}>
      {scopedHead ? <style>{scopedHead}</style> : null}
      <div
        className="email-canvas"
        onMouseDown={focusFromPadding}
      >
        <EditorContent editor={editor} />
      </div>
      {editor && editable ? (
        <>
          <BubbleMenu.Root
            placement="top"
            hideWhenActiveNodes={['button', 'horizontalRule', 'image']}
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
