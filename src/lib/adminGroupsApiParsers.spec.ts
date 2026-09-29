import { describe, expect, it } from 'vitest';
import {
  parseAdminGroupRow,
  parseAdminGroupsList,
  parseGroupsApiErrorMessage,
} from '@/lib/adminGroupsApiParsers';

describe('adminGroupsApiParsers', () => {
  it('parseAdminGroupRow prefers display_name and falls back to name', () => {
    expect(
      parseAdminGroupRow({
        id: 1,
        display_name: 'Analysts',
        source: 'manual',
        user_count: 3,
      }),
    ).toEqual({
      id: 1,
      display_name: 'Analysts',
      source: 'manual',
      user_count: 3,
    });

    expect(
      parseAdminGroupRow({
        id: 2,
        name: 'Legacy',
        user_count: 0,
      }),
    ).toEqual({
      id: 2,
      display_name: 'Legacy',
      source: 'manual',
      user_count: 0,
    });
  });

  it('parseAdminGroupRow maps scim source', () => {
    expect(
      parseAdminGroupRow({
        id: 9,
        display_name: 'Engineering',
        source: 'scim',
        user_count: 12,
      }).source,
    ).toBe('scim');
  });

  it('parseAdminGroupsList normalizes each row', () => {
    const rows = parseAdminGroupsList([
      { id: 1, display_name: 'A', source: 'manual', user_count: 1 },
      { id: 2, name: 'B', user_count: 0 },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[1].display_name).toBe('B');
  });

  it('parseGroupsApiErrorMessage formats field errors as sentences', () => {
    expect(
      parseGroupsApiErrorMessage({
        display_name: ['This field is required.'],
      }),
    ).toBe('Display name is required.');

    expect(parseGroupsApiErrorMessage({ detail: 'Group not found.' })).toBe('Group not found.');
  });

  it('parseGroupsApiErrorMessage joins multiple field errors', () => {
    expect(
      parseGroupsApiErrorMessage({
        display_name: ['This field is required.'],
        name: ['This field is required.'],
      }),
    ).toBe('Display name is required. Name is required.');
  });
});
