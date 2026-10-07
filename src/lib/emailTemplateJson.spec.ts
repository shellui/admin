import { describe, expect, it } from 'vitest';
import {
  parseTemplateJson,
  templateJsonText,
  type EmailTemplateJson,
} from '@/lib/emailTemplateJson';

const invited: EmailTemplateJson = {
  subject: '[Shellui] You are invited to {{ company_name }}',
  preheader: 'You have an invitation to {{ company_name }}.',
  document: {
    type: 'doc',
    content: [
      {
        type: 'container',
        attrs: { style: 'max-width:600px' },
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'You are invited to {{ company_name }}' }],
          },
          {
            type: 'button',
            attrs: { href: '{{ invitation_url }}' },
            content: [{ type: 'text', text: 'Open invitation' }],
          },
        ],
      },
    ],
  },
};

describe('parseTemplateJson', () => {
  it('reads the copied object as is', () => {
    expect(parseTemplateJson(JSON.stringify(invited))).toEqual({ ok: true, value: invited });
    expect(parseTemplateJson(templateJsonText(invited))).toEqual({ ok: true, value: invited });
  });

  it('accepts a bare document and leaves the subject alone', () => {
    const parsed = parseTemplateJson(JSON.stringify(invited.document));
    expect(parsed).toEqual({ ok: true, value: { document: invited.document } });
  });

  it('names what is wrong', () => {
    expect(parseTemplateJson('{ nope')).toEqual({ ok: false, error: { code: 'invalid_json' } });
    expect(parseTemplateJson('[]')).toEqual({ ok: false, error: { code: 'not_object' } });
    expect(parseTemplateJson(JSON.stringify({ subject: 'Hi', document: { blocks: [] } }))).toEqual({
      ok: false,
      error: { code: 'invalid_field', field: 'document' },
    });
    expect(parseTemplateJson(JSON.stringify({ ...invited, preheader: 3 }))).toEqual({
      ok: false,
      error: { code: 'invalid_field', field: 'preheader' },
    });
  });
});
