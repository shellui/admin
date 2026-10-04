import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export type TranslationHighlights = {
  missing: string[];
  outdated: string[];
  missingTitle: string;
  outdatedTitle: string;
};

export const TRANSLATION_HIGHLIGHT_KEY = new PluginKey('shelluiTranslationHighlight');

/** Outlines text blocks a translation has not covered. `source.current` is read on every redraw. */
export function translationHighlight(source: { current: TranslationHighlights | null }) {
  return Extension.create({
    name: 'shelluiTranslationHighlight',
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: TRANSLATION_HIGHLIGHT_KEY,
          props: {
            decorations(state) {
              const highlights = source.current;
              if (!highlights || (!highlights.missing.length && !highlights.outdated.length)) {
                return null;
              }
              const missing = new Set(highlights.missing);
              const outdated = new Set(highlights.outdated);
              const decorations: Decoration[] = [];
              state.doc.descendants((node, pos) => {
                const id = node.attrs.textId as string | null | undefined;
                if (!node.isTextblock || !id) return;
                if (missing.has(id)) {
                  decorations.push(
                    Decoration.node(pos, pos + node.nodeSize, {
                      class: 'email-translation-missing',
                      title: highlights.missingTitle,
                    }),
                  );
                } else if (outdated.has(id)) {
                  decorations.push(
                    Decoration.node(pos, pos + node.nodeSize, {
                      class: 'email-translation-outdated',
                      title: highlights.outdatedTitle,
                    }),
                  );
                }
                return false;
              });
              return DecorationSet.create(state.doc, decorations);
            },
          },
        }),
      ];
    },
  });
}
