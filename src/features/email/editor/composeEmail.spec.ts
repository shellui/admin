import { describe, expect, it } from 'vitest';
import { composeEmailHtml } from '@/features/email/editor/composeEmail';

describe('composeEmailHtml', () => {
  it('keeps the layout width, linked images, the head CSS, and the preheader', async () => {
    const html = await composeEmailHtml({
      head: '.title { color: red }',
      preheader: 'Your invitation',
      document: {
        type: 'doc',
        content: [
          {
            type: 'container',
            attrs: { style: 'max-width:600px;margin:0 auto' },
            content: [
              {
                type: 'image',
                attrs: {
                  src: '{{ system.assets_url }}/logo.png',
                  alt: 'Logo',
                  width: 120,
                  href: '{{ action_url }}',
                },
              },
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Hi {{ company_name }}' }],
              },
            ],
          },
        ],
      },
    });
    expect(html).toContain('<style>.title { color: red }</style>');
    expect(html).toMatch(/max-width:\s*600px/);
    expect(html).toMatch(/<a[^>]+href="\{\{ action_url \}\}"[^>]*><img[^>]+alt="Logo"/);
    expect(html).toContain('width="120"');
    expect(html).toContain('Your invitation');
    expect(html).toContain('Hi {{ company_name }}');
  }, 30_000);

  it('renders justified text, aligned images, and columns', async () => {
    const html = await composeEmailHtml({
      head: '',
      preheader: '',
      document: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            attrs: { alignment: 'justify', style: 'text-align:justify' },
            content: [{ type: 'text', text: 'Justified' }],
          },
          {
            type: 'image',
            attrs: { src: 'https://example.com/logo.png', alignment: 'center' },
          },
          { type: 'image', attrs: { src: '' } },
          {
            type: 'twoColumns',
            content: [
              {
                type: 'columnsColumn',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Left' }] }],
              },
              {
                type: 'columnsColumn',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Right' }] }],
              },
            ],
          },
        ],
      },
    });
    expect(html).toMatch(/<p[^>]+text-align:justify[^>]*>Justified/);
    expect(html).toMatch(/<img[^>]+margin-left:auto;margin-right:auto/);
    expect(html.match(/<img/g)).toHaveLength(1);
    expect(html).toMatch(/<td[^>]*>.*Left.*<\/td>.*<td[^>]*>.*Right/s);
  }, 30_000);

  it('paints theme roles with the theme, or the design colors without one', async () => {
    const document = {
      type: 'doc' as const,
      content: [
        {
          type: 'paragraph',
          attrs: {
            style:
              'color:var(--email-foreground,rgb(20,23,30));background-color:var(--email-muted,rgb(243,244,246))',
          },
          content: [{ type: 'text', text: 'Hi' }],
        },
      ],
    };
    const themed = await composeEmailHtml({
      head: '',
      preheader: '',
      document,
      colors: { foreground: '#0b1d33' },
    });
    expect(themed).toMatch(/color:\s*#0b1d33/);
    expect(themed).toMatch(/background-color:\s*rgb\(243,\s*244,\s*246\)/);
    expect(themed).not.toContain('var(');
    const plain = await composeEmailHtml({ head: '', preheader: '', document });
    expect(plain).toMatch(/color:\s*rgb\(20,\s*23,\s*30\)/);
    expect(plain).not.toContain('var(');
  }, 30_000);
});
