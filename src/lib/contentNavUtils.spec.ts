import { describe, it, expect } from 'vitest';
import {
  buildAdminHashContentUrl,
  findMatchingNavItem,
  getNavSubPath,
  getNavPathPrefix,
} from './contentNavUtils';

describe('buildAdminHashContentUrl', () => {
  it('builds root dashboard hash', () => {
    expect(buildAdminHashContentUrl('http://localhost:5174', '', '', '')).toBe(
      'http://localhost:5174/#/',
    );
  });

  it('builds path with subpath and search', () => {
    expect(buildAdminHashContentUrl('http://localhost:5174/', 'users', '42', '?tab=profile')).toBe(
      'http://localhost:5174/#/users/42?tab=profile',
    );
  });
});

describe('findMatchingNavItem', () => {
  const items = [
    { path: '', url: 'http://localhost/#/' },
    { path: 'users', url: 'http://localhost/#/users' },
    { path: 'storage', url: 'https://files.example/' },
    { path: 'storage/statistics', url: 'http://localhost/#/storage/statistics' },
    { path: 'app/billing', url: 'https://billing.example/' },
  ];

  it('matches longest path prefix', () => {
    expect(findMatchingNavItem('/storage/statistics', items)?.path).toBe('storage/statistics');
    expect(findMatchingNavItem('/users/abc', items)?.path).toBe('users');
    expect(findMatchingNavItem('/app/billing', items)?.path).toBe('app/billing');
  });

  it('matches root only for /', () => {
    expect(findMatchingNavItem('/', items)?.path).toBe('');
  });
});

describe('getNavSubPath / getNavPathPrefix', () => {
  it('computes subpath after prefix', () => {
    expect(getNavPathPrefix({ path: 'users' })).toBe('/users');
    expect(getNavSubPath('/users/42', { path: 'users' })).toBe('42');
    expect(getNavSubPath('/users', { path: 'users' })).toBe('');
  });
});
