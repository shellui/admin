import { describe, expect, it } from 'vitest';
import {
  defaultWelcomeEmailHtml,
  hasDocumentContent,
  normalizeEmailTemplate,
  resolveEmailEditorContent,
} from '@/lib/actionEmailDefaults';

describe('actionEmailDefaults', () => {
  it('uses document when present', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hi' }] }],
    };
    const content = resolveEmailEditorContent(
      { subject: 'S', html: '<p>x</p>', document: doc },
      'en',
    );
    expect(content).toEqual(doc);
  });

  it('falls back to html then built-in welcome sample', () => {
    expect(resolveEmailEditorContent({ subject: '', html: '<p>custom</p>' }, 'en')).toBe(
      '<p>custom</p>',
    );
    const fallback = resolveEmailEditorContent({ subject: '', html: '' }, 'en');
    expect(typeof fallback).toBe('string');
    expect(String(fallback)).toContain('{{ envelope.company.name }}');
  });

  it('normalizeEmailTemplate maps legacy body_html', () => {
    expect(normalizeEmailTemplate({ subject: 'Hi', body_html: '<p>a</p>' } as never, 'en')).toEqual(
      { subject: 'Hi', html: '<p>a</p>', document: undefined },
    );
  });

  it('hasDocumentContent detects non-empty doc', () => {
    expect(hasDocumentContent({ type: 'doc', content: [] })).toBe(false);
    expect(
      hasDocumentContent({
        type: 'doc',
        content: [{ type: 'paragraph' }],
      }),
    ).toBe(true);
  });

  it('defaultWelcomeEmailHtml includes placeholders', () => {
    expect(defaultWelcomeEmailHtml('fr')).toContain('{{ data.email }}');
  });
});
