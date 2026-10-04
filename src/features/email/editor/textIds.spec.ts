import { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';
import { emailDocumentExtensions } from '@/features/email/editor/emailNodes';
import { TextIdKeeper } from '@/features/email/editor/textIds';

let editor: Editor | null = null;

function create(content: object) {
  editor = new Editor({
    element: document.createElement('div'),
    extensions: [...emailDocumentExtensions(''), TextIdKeeper],
    content,
  });
  return editor;
}

function ids(current: Editor) {
  const out: Array<[string, string]> = [];
  current.state.doc.descendants((node) => {
    if (node.type.name === 'paragraph') out.push([node.attrs.textId as string, node.textContent]);
  });
  return out;
}

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe('TextIdKeeper', () => {
  const content = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        attrs: { textId: 'keep' },
        content: [{ type: 'text', text: 'Hello world' }],
      },
    ],
  };

  it('keeps the id on the words when Enter splits at the start', () => {
    const current = create(content);
    current.chain().setTextSelection(1).splitBlock().run();
    const [first, second] = ids(current);
    expect(second).toEqual(['keep', 'Hello world']);
    expect(first[0]).toMatch(/^[a-z0-9]{8}$/);
  });

  it('gives a new block its own id', () => {
    const current = create(content);
    let end = 0;
    current.state.doc.descendants((node, pos) => {
      if (node.type.name === 'paragraph') end = pos + node.nodeSize - 1;
    });
    current.chain().setTextSelection(end).splitBlock().insertContent('More').run();
    const [first, second] = ids(current);
    expect(first).toEqual(['keep', 'Hello world']);
    expect(second[0]).not.toBe('keep');
    expect(second[1]).toBe('More');
  });

  it('does not render the id', () => {
    const current = create(content);
    expect(current.getHTML()).not.toContain('keep');
  });
});
