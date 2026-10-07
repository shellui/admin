import { Extension, type Editor } from '@tiptap/core';

export const TEXT_ALIGNS = ['left', 'center', 'right', 'justify'] as const;
export type TextAlign = (typeof TEXT_ALIGNS)[number];

const ALIGNABLE = new Set(['paragraph', 'heading']);
const TEXT_ALIGN_DECLARATION = /^text-align\s*:/i;

function isTextAlign(value: unknown): value is TextAlign {
  return typeof value === 'string' && (TEXT_ALIGNS as readonly string[]).includes(value);
}

/** `style` with its `text-align` replaced. */
export function withTextAlign(style: unknown, align: TextAlign): string {
  const kept = String(style || '')
    .split(';')
    .map((declaration) => declaration.trim())
    .filter((declaration) => declaration && !TEXT_ALIGN_DECLARATION.test(declaration));
  return [...kept, `text-align:${align}`].join(';');
}

export function textAlignOf(attrs: Record<string, unknown>): TextAlign {
  const fromStyle = /(?:^|;)\s*text-align\s*:\s*([a-z]+)/i.exec(String(attrs.style || ''))?.[1];
  if (isTextAlign(fromStyle)) return fromStyle;
  return isTextAlign(attrs.alignment) ? attrs.alignment : 'left';
}

/** Alignment of the first text block in the selection. */
export function selectedTextAlign(editor: Editor): TextAlign {
  const { from, to } = editor.state.selection;
  let align: TextAlign | null = null;
  editor.state.doc.nodesBetween(from, to, (node) => {
    if (align) return false;
    if (!ALIGNABLE.has(node.type.name)) return true;
    align = textAlignOf(node.attrs);
    return false;
  });
  return align ?? 'left';
}

/**
 * The email renderer drops `alignment: "justify"`, so the value is also written
 * to the block's inline style, which every text node renders.
 */
export function setTextAlign(editor: Editor, align: TextAlign): boolean {
  return editor
    .chain()
    .focus()
    .command(({ tr }) => {
      const { from, to } = tr.selection;
      let changed = false;
      tr.doc.nodesBetween(from, to, (node, pos) => {
        if (!ALIGNABLE.has(node.type.name)) return true;
        tr.setNodeMarkup(pos, undefined, {
          ...node.attrs,
          alignment: align,
          style: withTextAlign(node.attrs.style, align),
        });
        changed = true;
        return false;
      });
      return changed;
    })
    .run();
}

/** Takes over the stock alignment shortcuts, which only set `alignment`. */
export const TextAlignShortcuts = Extension.create({
  name: 'shelluiTextAlign',
  priority: 1000,
  addKeyboardShortcuts() {
    return {
      'Mod-Shift-l': () => setTextAlign(this.editor, 'left'),
      'Mod-Shift-e': () => setTextAlign(this.editor, 'center'),
      'Mod-Shift-r': () => setTextAlign(this.editor, 'right'),
      'Mod-Shift-j': () => setTextAlign(this.editor, 'justify'),
    };
  },
});
