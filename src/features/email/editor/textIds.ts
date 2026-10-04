import { Extension } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { TEXT_BLOCK_TYPES, newTextId } from '@/lib/emailTranslations';

const TEXT_BLOCKS = new Set<string>(TEXT_BLOCK_TYPES);

/** Stored with the document, never rendered, so every language matches block by block. */
export const TextIdAttribute = Extension.create({
  name: 'shelluiTextId',
  addGlobalAttributes() {
    return [
      {
        types: [...TEXT_BLOCK_TYPES],
        attributes: {
          textId: { default: null, rendered: false, keepOnSplit: false },
        },
      },
    ];
  },
});

/**
 * Gives new text blocks an id. A split or paste can copy one; the copy with
 * the most text keeps it, so its translations follow the words.
 */
export function textIdFixes(doc: PMNode): Array<{ pos: number; id: string }> {
  const byId = new Map<string, Array<{ pos: number; size: number }>>();
  const fixes: Array<{ pos: number; id: string }> = [];
  doc.descendants((node, pos) => {
    if (!TEXT_BLOCKS.has(node.type.name)) return;
    const id = node.attrs.textId as string | null;
    if (!id) {
      fixes.push({ pos, id: newTextId() });
      return false;
    }
    const group = byId.get(id) ?? [];
    group.push({ pos, size: node.textContent.length });
    byId.set(id, group);
    return false;
  });
  for (const group of byId.values()) {
    if (group.length < 2) continue;
    const keeper = group.reduce((best, item) => (item.size > best.size ? item : best));
    for (const item of group) if (item !== keeper) fixes.push({ pos: item.pos, id: newTextId() });
  }
  return fixes;
}

export const TextIdKeeper = Extension.create({
  name: 'shelluiTextIdKeeper',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('shelluiTextIdKeeper'),
        appendTransaction(transactions, _old, state) {
          if (!transactions.some((tr) => tr.docChanged)) return null;
          const fixes = textIdFixes(state.doc);
          if (!fixes.length) return null;
          const tr = state.tr;
          for (const { pos, id } of fixes) tr.setNodeAttribute(pos, 'textId', id);
          return tr;
        },
      }),
    ];
  },
});
