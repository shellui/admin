import { describe, expect, it } from 'vitest';
import {
  INVITATIONS_ROUTE,
  adminModalUrl,
  inviteModalUrl,
  resolveShellAppUrl,
} from './inviteModal';

function locationWith(ancestors: string[] | undefined) {
  const list = ancestors
    ? Object.assign([...ancestors], {
        contains: (origin: string) => ancestors.includes(origin),
        item: (index: number) => ancestors[index] ?? null,
      })
    : undefined;
  return { ancestorOrigins: list } as unknown as Location & { ancestorOrigins?: DOMStringList };
}

describe('inviteModalUrl', () => {
  it('points at the invite hash route of this admin page', () => {
    expect(inviteModalUrl({ origin: 'https://admin.acme.com', pathname: '/' })).toBe(
      'https://admin.acme.com/#/invite',
    );
  });

  it('builds the pending invitations route', () => {
    expect(
      adminModalUrl(INVITATIONS_ROUTE, { origin: 'https://admin.acme.com', pathname: '/admin/' }),
    ).toBe('https://admin.acme.com/admin/#/invitations');
  });
});

describe('resolveShellAppUrl', () => {
  it('uses the outermost ancestor origin', () => {
    expect(
      resolveShellAppUrl(locationWith(['https://admin.acme.com', 'https://app.acme.com']), ''),
    ).toBe('https://app.acme.com/');
  });

  it('falls back to the referrer origin', () => {
    expect(resolveShellAppUrl(locationWith(undefined), 'https://app.acme.com/admin/users')).toBe(
      'https://app.acme.com/',
    );
  });

  it('returns null when nothing is known', () => {
    expect(resolveShellAppUrl(locationWith([]), '')).toBeNull();
  });
});
