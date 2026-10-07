import { describe, expect, it } from 'vitest';
import type { EmailDocument, EmailNode } from '@/lib/emailDocument';
import {
  applyTranslatedEdit,
  blockFingerprint,
  localizeDocument,
  markTranslationCurrent,
  pruneTranslations,
  textBlocks,
  translationStatus,
  withAllLanguages,
  withTextIds,
  type EmailTranslation,
} from '@/lib/emailTranslations';

const text = (value: string): EmailNode[] => [{ type: 'text', text: value }];

function block(id: string, value: string, attrs: Record<string, unknown> = {}): EmailNode {
  return { type: 'paragraph', attrs: { textId: id, ...attrs }, content: text(value) };
}

function doc(...content: EmailNode[]): EmailDocument {
  return { type: 'doc', content: [{ type: 'container', content }] };
}

const empty: EmailTranslation = { subject: '', preheader: '', blocks: {} };

describe('withTextIds', () => {
  it('fills missing ids and keeps the id on the longest copy', () => {
    const result = withTextIds(
      doc(
        { type: 'paragraph', content: text('No id') },
        block('same', ''),
        block('same', 'Most text'),
        { type: 'image', attrs: { src: '' } },
      ),
    );
    const ids = [...textBlocks(result).keys()];
    expect(ids).toHaveLength(3);
    expect(textBlocks(result).get('same')?.content).toEqual(text('Most text'));
  });
});

describe('applyTranslatedEdit', () => {
  const base = doc(block('a', 'Hello'), block('b', 'Bye'));

  it('keeps layout shared and text per language', () => {
    const edited = doc(block('a', 'Bonjour', { alignment: 'center' }), block('b', 'Bye'));
    const result = applyTranslatedEdit(base, empty, edited);
    expect(result.translation.blocks).toEqual({
      a: { content: text('Bonjour'), source: blockFingerprint(text('Hello')) },
    });
    expect(textBlocks(result.base).get('a')).toEqual(block('a', 'Hello', { alignment: 'center' }));
    expect(localizeDocument(result.base, result.translation)).toEqual(edited);
  });

  it('adds a block written in this language to both', () => {
    const edited = doc(block('a', 'Hello'), block('b', 'Bye'), block('c', 'Nouveau'));
    const result = applyTranslatedEdit(base, empty, edited);
    expect(textBlocks(result.base).get('c')?.content).toEqual(text('Nouveau'));
    expect(
      translationStatus(result.base, result.translation, { subject: '', preheader: '' }),
    ).toMatchObject({ missing: ['a', 'b'], outdated: [] });
  });

  it('drops a block deleted in any language', () => {
    const result = applyTranslatedEdit(
      base,
      { ...empty, blocks: { b: { content: text('Salut'), source: 'x' } } },
      doc(block('a', 'Hello')),
    );
    expect([...textBlocks(result.base).keys()]).toEqual(['a']);
    expect(result.translation.blocks).toEqual({});
  });
});

describe('translationStatus', () => {
  it('counts missing, outdated, and inbox fields', () => {
    const base = doc(block('a', 'Hello'), block('b', 'Bye'), block('c', '{{ name }}'));
    const translation: EmailTranslation = {
      subject: '',
      preheader: 'Avant',
      blocks: { b: { content: text('Salut'), source: blockFingerprint(text('Old bye')) } },
    };
    const status = translationStatus(base, translation, { subject: 'Hi', preheader: 'Pre' });
    expect(status).toEqual({
      missing: ['a'],
      outdated: ['b'],
      subjectMissing: true,
      preheaderMissing: false,
      todo: 3,
    });
    const current = markTranslationCurrent(base, translation);
    expect(translationStatus(base, current, { subject: 'Hi', preheader: '' }).outdated).toEqual([]);
  });
});

describe('withAllLanguages', () => {
  const suggested = {
    en: { subject: 'Welcome', preheader: 'Start here' },
    fr: { subject: 'Bienvenue', preheader: 'Commencez ici' },
  };

  it('starts an untouched suggestion in the other language', () => {
    expect(withAllLanguages({}, 'en', suggested.en, suggested)).toEqual({
      fr: { subject: 'Bienvenue', preheader: 'Commencez ici', blocks: {} },
    });
  });

  it('leaves an edited subject to translate', () => {
    const result = withAllLanguages({}, 'en', { subject: 'Hi', preheader: '' }, suggested);
    expect(result.fr).toEqual(empty);
  });
});

describe('pruneTranslations', () => {
  it('removes blocks the layout lost', () => {
    const result = pruneTranslations(doc(block('a', 'Hello')), {
      fr: {
        ...empty,
        blocks: {
          a: { content: text('Bonjour'), source: '' },
          gone: { content: text('Parti'), source: '' },
        },
      },
    });
    expect(Object.keys(result.fr?.blocks ?? {})).toEqual(['a']);
  });
});
