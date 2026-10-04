import { Editor } from '@tiptap/core';
import type { DOMParser } from '@tiptap/pm/model';
import { afterEach, describe, expect, it } from 'vitest';
import { emailEditorExtensions } from '@/features/email/editor/extensions';

let editor: Editor | null = null;

afterEach(() => {
  editor?.destroy();
  editor = null;
});

function reread(content: object) {
  editor = new Editor({
    element: document.createElement('div'),
    extensions: emailEditorExtensions({ head: '', placeholder: '' }),
    content,
  });
  const parser = editor.view.someProp('domParser') as DOMParser;
  const marks: string[] = [];
  parser.parse(editor.view.dom).descendants((node) => {
    if (node.isText) marks.push(node.marks.map((mark) => mark.type.name).join('+'));
  });
  return marks;
}

function linkParagraph(marks: object[]) {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'Learn more',
            marks: [
              {
                type: 'link',
                attrs: { href: 'https://shellui.com', style: 'text-decoration-line:none' },
              },
              ...marks,
            ],
          },
        ],
      },
    ],
  };
}

describe('CanvasDomParser', () => {
  it('reads a link back without an underline mark', () => {
    expect(reread(linkParagraph([]))).toEqual(['link']);
  });

  it('keeps an underline the author added', () => {
    expect(reread(linkParagraph([{ type: 'underline' }]))).toEqual(['link+underline']);
  });
});
