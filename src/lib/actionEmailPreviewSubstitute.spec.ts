import { describe, expect, it } from 'vitest';
import {
  buildEmailPreviewContextFromVariables,
  normalizeEmailPreviewContext,
  sanitizeActionEmailUrl,
  substituteActionEmailTemplate,
} from '@/lib/actionEmailPreviewSubstitute';

describe('substituteActionEmailTemplate', () => {
  const context = {
    envelope: {
      company: { name: 'Acme', slug: 'acme', id: 1 },
      type: 'identity.auth.magic_link.requested',
    },
    data: {
      email: 'ada@acme.com',
      magic_link_url: 'https://id.example.com/verify?token=abc&company_id=1',
      token_prefix: 'sh_live_',
      name: '',
    },
  };

  it('replaces dotted paths', () => {
    expect(
      substituteActionEmailTemplate(
        'Hi {{ data.email }} from {{ envelope.company.name }}',
        context,
        'html',
      ),
    ).toBe('Hi ada@acme.com from Acme');
  });

  it('supports default string and path filters', () => {
    expect(substituteActionEmailTemplate('{{ data.name|default:"user" }}', context, 'html')).toBe(
      'user',
    );
    expect(
      substituteActionEmailTemplate('{{ data.name|default:data.token_prefix }}', context, 'html'),
    ).toBe('sh_live_');
  });

  it('supports title filter', () => {
    expect(
      substituteActionEmailTemplate('{{ envelope.company.slug|title }}', context, 'html'),
    ).toBe('Acme');
  });

  it('leaves missing paths empty', () => {
    expect(substituteActionEmailTemplate('x={{ data.missing }}y', context, 'html')).toBe('x=y');
  });

  it('html-escapes injected markup in text nodes', () => {
    const dirty = {
      ...context,
      data: {
        ...context.data,
        display_name: '</strong><a href="https://evil.example">x</a><strong>',
      },
    };
    const out = substituteActionEmailTemplate(
      '<p><strong>{{ data.display_name }}</strong></p>',
      dirty,
      'html',
    );
    expect(out).toContain('&lt;/strong&gt;&lt;a href=');
    expect(out).not.toContain('<a href="https://evil.example">');
  });

  it('keeps safe href URLs and escapes ampersands', () => {
    const out = substituteActionEmailTemplate(
      '<a href="{{ data.magic_link_url }}">Sign in</a>',
      context,
      'html',
    );
    expect(out).toContain('href="https://id.example.com/verify?token=abc&amp;company_id=1"');
  });

  it('strips dangerous schemes in URL attributes', () => {
    const dirty = {
      ...context,
      data: { ...context.data, display_name: 'javascript:alert(1)' },
    };
    const out = substituteActionEmailTemplate(
      '<a href="{{ data.display_name }}">Go</a>',
      dirty,
      'html',
    );
    expect(out).toContain('href=""');
    expect(out).not.toContain('javascript:');
  });

  it('plain mode strips newlines without HTML-escaping', () => {
    const dirty = {
      ...context,
      data: { ...context.data, name: 'Ada\nAdmin <ops>' },
    };
    expect(substituteActionEmailTemplate('Hi {{ data.name }}', dirty, 'plain')).toBe(
      'Hi Ada Admin <ops>',
    );
  });
});

describe('sanitizeActionEmailUrl', () => {
  it('allows safe schemes only', () => {
    expect(sanitizeActionEmailUrl('https://a.example/x')).toBe('https://a.example/x');
    expect(sanitizeActionEmailUrl('mailto:a@b.com')).toBe('mailto:a@b.com');
    expect(sanitizeActionEmailUrl('#')).toBe('#');
    expect(sanitizeActionEmailUrl('javascript:alert(1)')).toBe('');
    expect(sanitizeActionEmailUrl('/relative')).toBe('');
  });
});

describe('buildEmailPreviewContextFromVariables', () => {
  it('nests envelope and data examples', () => {
    const ctx = buildEmailPreviewContextFromVariables([
      { token: 'envelope.company.name', example: 'Shellui' },
      { token: 'data.email', example: 'dev@shellui.com' },
      { token: 'data.magic_link_url', example: 'https://example.com/ml' },
    ]);
    expect(ctx.envelope?.company).toMatchObject({ name: 'Shellui' });
    expect(ctx.data?.email).toBe('dev@shellui.com');
    expect(ctx.data?.magic_link_url).toBe('https://example.com/ml');
  });
});

describe('normalizeEmailPreviewContext', () => {
  it('accepts identity sample_context shape', () => {
    const ctx = normalizeEmailPreviewContext({
      envelope: { company: { name: 'Actions Co' }, data: { email: 'a@b.com' } },
      data: { email: 'a@b.com', magic_link_url: 'https://x' },
    });
    expect(ctx?.data?.magic_link_url).toBe('https://x');
    expect((ctx?.envelope?.company as { name: string }).name).toBe('Actions Co');
  });

  it('rejects empty payloads', () => {
    expect(normalizeEmailPreviewContext(null)).toBeNull();
    expect(normalizeEmailPreviewContext({})).toBeNull();
  });
});
