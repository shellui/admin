import { Extension, Node, mergeAttributes, type Extensions } from '@tiptap/core';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { StarterKit } from '@react-email/editor/extensions';

const TOKEN_RE = /\{\{\s*[a-zA-Z_][a-zA-Z0-9_.]*\s*(?:\|\s*default\s*:\s*"[^"]*"\s*)?\}\}/g;

/** Small print under the content, rendered as the `footer` block. */
export const EmailFooter = Node.create({
  name: 'footer',
  group: 'block',
  content: 'inline*',
  defining: true,
  parseHTML() {
    return [{ tag: 'p[data-type="footer"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'p',
      mergeAttributes(HTMLAttributes, { 'data-type': 'footer', class: 'node-footer' }),
      0,
    ];
  },
});

/** Marks `{{ token }}` placeholders so they read as variables in the canvas. */
export const TokenHighlight = Extension.create({
  name: 'tokenHighlight',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('tokenHighlight'),
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return;
              for (const match of node.text.matchAll(TOKEN_RE)) {
                const from = pos + (match.index ?? 0);
                decorations.push(
                  Decoration.inline(from, from + match[0].length, { class: 'email-token' }),
                );
              }
            });
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});

export type EmailEditorPlaceholders = {
  text: string;
  heading: string;
  footer: string;
};

/** Only nodes and marks the Shellui block document can store. */
export function emailEditorExtensions(placeholders: EmailEditorPlaceholders): Extensions {
  return [
    StarterKit.configure({
      CodeBlockPrism: false,
      Code: false,
      TwoColumns: false,
      ThreeColumns: false,
      FourColumns: false,
      ColumnsColumn: false,
      Blockquote: false,
      Strike: false,
      Sup: false,
      Uppercase: false,
      PreservedStyle: false,
      Table: false,
      TableRow: false,
      TableCell: false,
      TableHeader: false,
      Body: false,
      Container: false,
      Div: false,
      Section: false,
      GlobalContent: false,
      PreviewText: false,
      AlignmentAttribute: false,
      StyleAttribute: false,
      ClassAttribute: false,
      Heading: { levels: [1] },
    }),
    EmailFooter,
    TokenHighlight,
    Placeholder.configure({
      includeChildren: true,
      placeholder: ({ node }) => {
        if (node.type.name === 'heading') return placeholders.heading;
        if (node.type.name === 'footer') return placeholders.footer;
        if (node.type.name === 'button') return '';
        return placeholders.text;
      },
    }),
  ];
}
