import { describe, expect, it } from 'vitest';
import { listNeedsSearch, sectionTitle } from '@/lib/emailList';

describe('email list headings', () => {
  it('shows a count only above 5 items and updates with the visible length', () => {
    expect(sectionTitle('Events', 5)).toBe('Events');
    expect(sectionTitle('Events', 6)).toBe('Events (6)');
    expect(sectionTitle('Events', 18)).toBe('Events (18)');
    expect(sectionTitle('Events', 2)).toBe('Events');
  });

  it('asks for search once the list is longer than a few items', () => {
    expect(listNeedsSearch(4)).toBe(false);
    expect(listNeedsSearch(5)).toBe(true);
  });
});
