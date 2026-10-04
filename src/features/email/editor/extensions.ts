import { Extension, type Extensions } from '@tiptap/core';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { emailDocumentExtensions } from '@/features/email/editor/emailNodes';

const TOKEN_RE = /\{\{\s*[a-zA-Z_][a-zA-Z0-9_.]*\s*(?:\|\s*default\s*:\s*"[^"]*"\s*)?\}\}/g;

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

/** The stored node set plus editing helpers. */
export function emailEditorExtensions({
  head,
  placeholder,
}: {
  head: string;
  placeholder: string;
}): Extensions {
  return [
    ...emailDocumentExtensions(head),
    TokenHighlight,
    Placeholder.configure({
      placeholder: ({ node }) => (node.type.name === 'paragraph' ? placeholder : ''),
    }),
  ];
}
