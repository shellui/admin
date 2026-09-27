import { describe, expect, it } from 'vitest';
import {
  formatActionEmailPlaceholder,
  isActionEmailTemplatePlaceholder,
  validateActionEmailUrl,
} from './actionEmailUrl';

describe('actionEmailUrl', () => {
  it('accepts Mustache placeholders used as button/link hrefs', () => {
    expect(validateActionEmailUrl('{{ data.magic_link_url }}')).toBe('{{ data.magic_link_url }}');
    expect(validateActionEmailUrl('{{data.magic_link_url}}')).toBe('{{data.magic_link_url}}');
    expect(isActionEmailTemplatePlaceholder('{{ data.magic_link_url }}')).toBe(true);
  });

  it('accepts normal safe URLs like the stock bubble-menu validator', () => {
    expect(validateActionEmailUrl('https://example.com/path')).toBe('https://example.com/path');
    expect(validateActionEmailUrl('mailto:a@b.com')).toBe('mailto:a@b.com');
    expect(validateActionEmailUrl('#')).toBe('#');
    expect(validateActionEmailUrl('example.com')).toBe('https://example.com/');
  });

  it('rejects empty and dangerous schemes', () => {
    expect(validateActionEmailUrl('')).toBeNull();
    expect(validateActionEmailUrl('   ')).toBeNull();
    expect(validateActionEmailUrl('javascript:alert(1)')).toBeNull();
    expect(validateActionEmailUrl('not a url')).toBeNull();
  });

  it('formats insertable tokens', () => {
    expect(formatActionEmailPlaceholder('data.magic_link_url')).toBe('{{ data.magic_link_url }}');
  });
});
