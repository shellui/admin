/** Search appears once a list is longer than a few rows. */
export const EMAIL_LIST_SEARCH_MIN = 5;

/** Section titles include a count only above 5 visible rows. */
export const EMAIL_SECTION_COUNT_MIN = 6;

export function listNeedsSearch(itemCount: number): boolean {
  return itemCount >= EMAIL_LIST_SEARCH_MIN;
}

export function sectionTitle(label: string, count: number): string {
  return count >= EMAIL_SECTION_COUNT_MIN ? `${label} (${count})` : label;
}

export function filterByQuery<T>(items: T[], query: string, textOf: (item: T) => string): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return items;
  return items.filter((item) => textOf(item).toLowerCase().includes(needle));
}
