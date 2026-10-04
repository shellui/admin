import { describe, expect, it } from 'vitest';
import type { EmailDocument } from '@/lib/emailDocument';
import { documentToTiptap, tiptapToDocument } from '@/features/email/editor/tiptapDocument';
import { normalizeLink } from '@/features/email/editor/EmailInlineEditor';

const DOCUMENT: EmailDocument = {
  preview: 'Inbox',
  blocks: [
    { type: 'heading', text: 'Hi {{ name }}' },
    {
      type: 'text',
      text: 'Read the docs.\nThanks',
      content: [
        { text: 'Read ' },
        { text: 'the docs', bold: true, href: 'https://shellui.com/docs' },
        { text: '.\nThanks', italic: true, underline: true },
      ],
    },
    {
      type: 'list',
      ordered: true,
      items: [{ text: 'One' }, { text: 'Two', content: [{ text: 'Two', bold: true }] }],
    },
    { type: 'divider' },
    { type: 'button', text: 'Open', href: '{{ app_url }}' },
    { type: 'footer', text: 'Sent by Shellui' },
  ],
};

describe('tiptap document conversion', () => {
  it('round-trips every block type and inline mark', () => {
    expect(tiptapToDocument(documentToTiptap(DOCUMENT), 'Inbox')).toEqual(DOCUMENT);
  });

  it('ends with an empty paragraph so the caret can move past the last block', () => {
    const json = documentToTiptap({ preview: '', blocks: [{ type: 'divider' }] });
    expect(json.content?.map((node) => node.type)).toEqual(['horizontalRule', 'paragraph']);
  });

  it('drops empty paragraphs, merges equal marks, and keeps plain blocks plain', () => {
    const document = tiptapToDocument(
      {
        type: 'doc',
        content: [
          { type: 'paragraph' },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'a', marks: [{ type: 'bold' }] },
              { type: 'text', text: 'b', marks: [{ type: 'bold' }] },
              { type: 'hardBreak' },
              { type: 'text', text: 'c' },
            ],
          },
          { type: 'paragraph', content: [{ type: 'text', text: 'plain' }] },
          { type: 'button', attrs: { href: '#' }, content: [{ type: 'text', text: 'Go' }] },
        ],
      },
      '',
    );
    expect(document.blocks).toEqual([
      { type: 'text', text: 'ab\nc', content: [{ text: 'ab\n', bold: true }, { text: 'c' }] },
      { type: 'text', text: 'plain' },
      { type: 'button', text: 'Go', href: '' },
    ]);
  });

  it('flattens nested list items into one list', () => {
    const document = tiptapToDocument(
      {
        type: 'doc',
        content: [
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  { type: 'paragraph', content: [{ type: 'text', text: 'Parent' }] },
                  {
                    type: 'bulletList',
                    content: [
                      {
                        type: 'listItem',
                        content: [
                          { type: 'paragraph', content: [{ type: 'text', text: 'Child' }] },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      '',
    );
    expect(document.blocks).toEqual([
      { type: 'list', items: [{ text: 'Parent' }, { text: 'Child' }] },
    ]);
  });
});

describe('normalizeLink', () => {
  it('keeps safe links and placeholders, completes bare addresses, and refuses the rest', () => {
    expect(normalizeLink('https://shellui.com')).toBe('https://shellui.com');
    expect(normalizeLink('{{ app_url }}')).toBe('{{ app_url }}');
    expect(normalizeLink('shellui.com/docs')).toBe('https://shellui.com/docs');
    expect(normalizeLink('ada@acme.com')).toBe('mailto:ada@acme.com');
    expect(normalizeLink('javascript:alert(1)')).toBeNull();
    expect(normalizeLink('  ')).toBeNull();
  });
});
