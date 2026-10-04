import { Extension, type Extensions } from '@tiptap/core';
import { Placeholder } from '@tiptap/extension-placeholder';
import { DOMParser } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { emailDocumentExtensions } from '@/features/email/editor/emailNodes';
import { TextAlignShortcuts } from '@/features/email/editor/textAlign';
import { TextIdKeeper } from '@/features/email/editor/textIds';

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

/**
 * The link renderer styles every `<a>` with `text-decoration: underline`, so
 * re-reading the canvas DOM (focus change, autocorrect) would add an underline
 * mark to links. `<u>` still parses, and paste keeps every rule.
 */
export const CanvasDomParser = Extension.create({
  name: 'canvasDomParser',
  addProseMirrorPlugins() {
    const { schema } = this.editor;
    const rules = DOMParser.fromSchema(schema).rules.filter(
      (rule) => !('style' in rule && rule.mark === 'underline'),
    );
    return [
      new Plugin({
        key: new PluginKey('canvasDomParser'),
        props: { domParser: new DOMParser(schema, rules) },
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
    TextAlignShortcuts,
    TextIdKeeper,
    CanvasDomParser,
    Placeholder.configure({
      placeholder: ({ node }) => (node.type.name === 'paragraph' ? placeholder : ''),
    }),
  ];
}
