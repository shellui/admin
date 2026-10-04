import { describe, expect, it } from 'vitest';
import {
  parseTemplateJson,
  templateJsonText,
  type EmailTemplateJson,
} from '@/lib/emailTemplateJson';
import { colorThemePalette } from '@/lib/emailTheme';

const invited: EmailTemplateJson = {
  subject: '[Shellui] You are invited to {{ company_name }}',
  preheader: 'You have an invitation to {{ company_name }}.',
  document: {
    preview: 'You have an invitation to {{ company_name }}.',
    blocks: [
      { type: 'heading', text: 'You are invited to {{ company_name }}' },
      { type: 'button', text: 'Open invitation', href: '{{ invitation_url }}' },
    ],
  },
};

describe('parseTemplateJson', () => {
  it('reads an email-service defaults file as is', () => {
    const parsed = parseTemplateJson(JSON.stringify(invited));
    expect(parsed).toEqual({ ok: true, value: invited });
  });

  it('round-trips the copied text with the template and colors', () => {
    const value = { ...invited, theme_name: 'matte', theme_palette: colorThemePalette('ocean')! };
    expect(parseTemplateJson(templateJsonText(value))).toEqual({ ok: true, value });
  });

  it('accepts a bare document and leaves the subject alone', () => {
    const parsed = parseTemplateJson(JSON.stringify(invited.document));
    expect(parsed.ok && parsed.value.document.blocks).toHaveLength(2);
    expect(parsed.ok && 'subject' in parsed.value).toBe(false);
  });

  it('accepts inline formatting, lists, and dividers', () => {
    const blocks = [
      { type: 'text', text: 'Hi you', content: [{ text: 'Hi ' }, { text: 'you', bold: true }] },
      { type: 'list', ordered: true, items: [{ text: 'One' }] },
      { type: 'divider' },
    ];
    const parsed = parseTemplateJson(JSON.stringify({ document: { preview: '', blocks } }));
    expect(parsed.ok && parsed.value.document.blocks).toEqual(blocks);
    for (const broken of [
      { type: 'text', text: 'x', content: [{ text: 'x', bold: 'yes' }] },
      { type: 'text', text: 'x', content: 'x' },
      { type: 'list', items: 'x' },
      { type: 'list', ordered: 'yes', items: [] },
    ]) {
      expect(
        parseTemplateJson(JSON.stringify({ document: { preview: '', blocks: [broken] } })),
      ).toEqual({ ok: false, error: { code: 'invalid_block', index: 0 } });
    }
  });

  it('names what is wrong', () => {
    expect(parseTemplateJson('{ nope')).toEqual({ ok: false, error: { code: 'invalid_json' } });
    expect(parseTemplateJson('[]')).toEqual({ ok: false, error: { code: 'not_object' } });
    expect(
      parseTemplateJson(
        JSON.stringify({ ...invited, document: { blocks: [{ type: 'image', text: '' }] } }),
      ),
    ).toEqual({ ok: false, error: { code: 'invalid_block', index: 0 } });
    expect(parseTemplateJson(JSON.stringify({ ...invited, theme_name: 'neon' }))).toEqual({
      ok: false,
      error: { code: 'unknown_template', value: 'neon' },
    });
    expect(
      parseTemplateJson(JSON.stringify({ ...invited, theme_palette: { primary: '#fff' } })),
    ).toEqual({ ok: false, error: { code: 'invalid_palette' } });
  });
});
