import { afterEach, describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import { emailDocumentExtensions } from '@/features/email/editor/emailNodes';
import {
  selectedTextAlign,
  setTextAlign,
  textAlignOf,
  withTextAlign,
} from '@/features/email/editor/textAlign';

describe('withTextAlign', () => {
  it('replaces an existing text-align and keeps the other declarations', () => {
    expect(withTextAlign('color:red; text-align:center;', 'justify')).toBe(
      'color:red;text-align:justify',
    );
    expect(withTextAlign('', 'right')).toBe('text-align:right');
  });
});

describe('textAlignOf', () => {
  it('reads the style first, then the alignment attribute', () => {
    expect(textAlignOf({ style: 'text-align:justify', alignment: 'center' })).toBe('justify');
    expect(textAlignOf({ alignment: 'center' })).toBe('center');
    expect(textAlignOf({})).toBe('left');
  });
});

describe('setTextAlign', () => {
  let editor: Editor | null = null;
  afterEach(() => editor?.destroy());

  it('sets alignment and style on every selected text block', () => {
    editor = new Editor({
      extensions: emailDocumentExtensions(),
      content: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1, alignment: 'center' },
            content: [{ type: 'text', text: 'Title' }],
          },
          { type: 'paragraph', content: [{ type: 'text', text: 'Body' }] },
        ],
      },
    });
    editor.commands.selectAll();
    expect(setTextAlign(editor, 'justify')).toBe(true);
    const container = editor.state.doc.child(0);
    for (const block of [container.child(0), container.child(1)]) {
      expect(block.attrs).toMatchObject({ alignment: 'justify', style: 'text-align:justify' });
    }
    expect(selectedTextAlign(editor)).toBe('justify');
  });
});
