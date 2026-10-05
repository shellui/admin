import '@react-email/editor/themes/default.css';
import '@/features/email/editor/emailCanvas.css';
import {
  createElement,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type MouseEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import type { Schema } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import type { Editor } from '@tiptap/core';
import { EditorContent, EditorContext, useEditor, useEditorState } from '@tiptap/react';
import { BubbleMenu, SlashCommand, type SlashCommandItem } from '@react-email/editor/ui';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Braces,
  Columns2,
  Columns3,
  Columns4,
  Heading1,
  Heading2,
  ImageIcon,
  List,
  ListOrdered,
  Minus,
  MousePointerClick,
  Pilcrow,
} from 'lucide-react';
import {
  ASSETS_TOKEN,
  formatEmailPlaceholder,
  safeHref,
  withAssetsUrl,
  withoutAssetsUrl,
  type EmailDocument,
  type EmailNode,
  type EmailVariable,
} from '@/lib/emailDocument';
import { scopeHeadCss } from '@/lib/emailHeadCss';
import { emailThemeStyle, type EmailThemeColors } from '@/lib/emailThemes';
import { emailEditorExtensions } from '@/features/email/editor/extensions';
import { SlashPluginReset } from '@/features/email/editor/slashPluginReset';
import { EmailImageMenu } from '@/features/email/editor/EmailImageMenu';
import {
  TEXT_ALIGNS,
  selectedTextAlign,
  setTextAlign,
  type TextAlign,
} from '@/features/email/editor/textAlign';
import {
  TRANSLATION_HIGHLIGHT_KEY,
  translationHighlight,
  type TranslationHighlights,
} from '@/features/email/editor/translationHighlight';

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

const COLUMN_ICONS = { 2: Columns2, 3: Columns3, 4: Columns4 } as const;

const ALIGN_ICONS: Record<TextAlign, typeof AlignLeft> = {
  left: AlignLeft,
  center: AlignCenter,
  right: AlignRight,
  justify: AlignJustify,
};
const ALIGN_LABELS: Record<TextAlign, string> = {
  left: 'emailAlignLeft',
  center: 'emailAlignCenter',
  right: 'emailAlignRight',
  justify: 'emailAlignJustify',
};

function TextAlignItems({ editor }: { editor: Editor }) {
  const { t } = useTranslation();
  const current = useEditorState({
    editor,
    selector: ({ editor: e }) => (e ? selectedTextAlign(e) : 'left'),
  });
  return (
    <BubbleMenu.ItemGroup>
      {TEXT_ALIGNS.map((align) => {
        const Icon = ALIGN_ICONS[align];
        return (
          <BubbleMenu.Item
            key={align}
            name={t(ALIGN_LABELS[align])}
            isActive={current === align}
            onCommand={() => setTextAlign(editor, align)}
          >
            <Icon size={16} />
          </BubbleMenu.Item>
        );
      })}
    </BubbleMenu.ItemGroup>
  );
}

export const EmailInlineEditor = forwardRef<
  EmailInlineEditorHandle,
  {
    /** Initial content. Remount the editor (change its `key`) to load another document. */
    document: EmailDocument;
    /** Fonts and mobile rules of the design's set. */
    head: string;
    /** Service URL that `{{ system.assets_url }}` stands for in images and font sources while editing. */
    assetsUrl: string;
    variables: EmailVariable[];
    label: string;
    editable?: boolean;
    /** Blocks a translation still has to cover. */
    highlights?: TranslationHighlights | null;
    /** The theme's colors. Changing them repaints the canvas in place. */
    themeColors?: EmailThemeColors;
    onChange: (document: EmailDocument) => void;
    onFocus?: () => void;
  }
>(function EmailInlineEditor(
  {
    document,
    head,
    assetsUrl,
    variables,
    label,
    editable = true,
    highlights,
    themeColors,
    onChange,
    onFocus,
  },
  ref,
) {
  const { t } = useTranslation();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onFocusRef = useRef(onFocus);
  onFocusRef.current = onFocus;
  const focusedOnce = useRef(false);
  const highlightsRef = useRef(highlights ?? null);
  highlightsRef.current = highlights ?? null;

  const editor = useEditor({
    extensions: [
      ...emailEditorExtensions({ head, placeholder: t('emailEditorPlaceholder') }),
      translationHighlight(highlightsRef),
    ],
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
    // Designs often start with a logo, which would otherwise be the initial selection and open its menu.
    onCreate: ({ editor: created }) => {
      const start = TextSelection.findFrom(created.state.doc.resolve(0), 1, true);
      if (start)
        created.view.dispatch(created.state.tr.setSelection(start).setMeta('addToHistory', false));
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

  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      editor.view.dispatch(editor.state.tr.setMeta(TRANSLATION_HIGHLIGHT_KEY, true));
    }
  }, [editor, highlights]);
  const scopedHead = useMemo(
    () => scopeHeadCss(assetsUrl ? head.replaceAll(ASSETS_TOKEN, assetsUrl) : head, CANVAS_SCOPE),
    [head, assetsUrl],
  );
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
      {
        title: t('emailBlock_image'),
        description: t('emailSlash_image'),
        icon: <ImageIcon {...ICON} />,
        category: blocks,
        searchTerms: ['image', 'img', 'logo', 'picture', 'photo'],
        command: ({ editor: e, range }) => {
          e.chain()
            .focus()
            .deleteRange(range)
            .insertContent({ type: 'image', attrs: { src: '' } })
            .run();
        },
      },
      ...([2, 3, 4] as const).map(
        (count): SlashCommandItem => ({
          title: t(`emailBlock_columns${count}`),
          description: t('emailSlash_columns'),
          icon: createElement(COLUMN_ICONS[count], ICON),
          category: blocks,
          searchTerms: ['columns', 'colonnes', 'layout', 'grid', String(count)],
          command: ({ editor: e, range }) => {
            e.chain().focus().deleteRange(range).insertColumns(count).run();
          },
        }),
      ),
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
        style={emailThemeStyle(themeColors)}
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
            <TextAlignItems editor={editor} />
            <BubbleMenu.ItemGroup>
              <BubbleMenu.LinkSelector validateUrl={normalizeLink} />
            </BubbleMenu.ItemGroup>
          </BubbleMenu.Root>
          <BubbleMenu.LinkDefault validateUrl={normalizeLink} />
          <BubbleMenu.ButtonDefault validateUrl={normalizeLink} />
          <EmailImageMenu
            editor={editor}
            assetsUrl={assetsUrl}
            validateLink={normalizeLink}
          />
          <SlashPluginReset editor={editor} />
          <SlashCommand items={items} />
        </>
      ) : null}
    </EditorContext.Provider>
  );
});

export default EmailInlineEditor;
