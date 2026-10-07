import { describe, expect, it } from 'vitest';
import { emailAssetsUrl, libraryPreviewHtml, librarySections } from '@/lib/emailLibrary';
import type { EmailLibraryTemplate } from '@/lib/emailTypes';

function template(id: number, set: string, builtIn = true): EmailLibraryTemplate {
  return {
    id,
    key: `${set}.t${id}`,
    set,
    name: `T${id}`,
    builtIn,
    companyId: builtIn ? null : 42,
    subject: '',
    preheader: '',
    updatedAt: null,
    html: '',
  };
}

describe('emailLibrary', () => {
  it('points the assets token at the service static folder', () => {
    expect(emailAssetsUrl('https://email.shellui.com/')).toBe(
      'https://email.shellui.com/static/library',
    );
    expect(
      libraryPreviewHtml(
        '<img src="{{ system.assets_url }}/logo.png"><a href="{{ action_url }}">{{ company_name }}</a>',
        'https://email.shellui.com/static/library',
      ),
    ).toBe(
      '<img src="https://email.shellui.com/static/library/logo.png"><a href="https://example.com">Acme</a>',
    );
  });

  it('lists company templates first, then built-ins by set order, skipping empty sets', () => {
    const sections = librarySections(
      [
        { key: 'barebone', name: 'Barebone' },
        { key: 'arcane', name: 'Arcane' },
        { key: 'studio', name: 'Studio' },
      ],
      [template(1, 'arcane'), template(2, 'barebone'), template(3, 'barebone', false)],
      'Company templates',
    );
    expect(
      sections.map((section) => [section.key, section.templates.map((row) => row.id)]),
    ).toEqual([
      ['company', [3]],
      ['barebone', [2]],
      ['arcane', [1]],
    ]);
  });
});
