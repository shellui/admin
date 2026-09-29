import { describe, expect, it } from 'vitest';
import { auditSvgMarkupIds, prefixSvgDocumentIds } from '@/lib/oauthSvgIds';

const GRADIENT_A = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><linearGradient id="a"><stop stop-color="yellow"/></linearGradient></defs><rect fill="url(#a)" width="10" height="10"/></svg>`;
const GRADIENT_B = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><linearGradient id="a"><stop stop-color="green"/></linearGradient></defs><circle fill="url(#a)" r="5" cx="5" cy="5"/></svg>`;

describe('prefixSvgDocumentIds', () => {
  it('scopes ids and url references to one SVG document', () => {
    const scoped = prefixSvgDocumentIds(GRADIENT_A, 'one-');
    const audit = auditSvgMarkupIds(scoped);
    expect(audit.duplicateIds).toEqual([]);
    expect(audit.brokenReferences).toEqual([]);
    expect(scoped).toContain('id="one-a"');
    expect(scoped).toContain('url(#one-a)');
  });

  it('does not treat hex paint values as fragment id references', () => {
    const markup =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect fill="#635BFF" width="10" height="10"/><path fill="#fff" d="M0 0h10v10H0z"/></svg>';
    const audit = auditSvgMarkupIds(markup);
    expect(audit.brokenReferences).toEqual([]);
  });

  it('allows two SVG documents with formerly identical ids on one page', () => {
    const first = prefixSvgDocumentIds(GRADIENT_A, 'i1-');
    const second = prefixSvgDocumentIds(GRADIENT_B, 'i2-');
    const html = `<div>${first}${second}</div>`;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const ids = [...doc.querySelectorAll('[id]')].map((el) => el.getAttribute('id'));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
