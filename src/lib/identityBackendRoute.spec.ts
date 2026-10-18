import { describe, expect, it } from 'vitest';
import { routeShowsIdentityBackendMissing } from '@/lib/identityBackendRoute';

describe('routeShowsIdentityBackendMissing', () => {
  it('gates identity pages and leaves other services mounted', () => {
    expect(routeShowsIdentityBackendMissing('/users')).toBe(true);
    expect(routeShowsIdentityBackendMissing('/users/4')).toBe(true);
    expect(routeShowsIdentityBackendMissing('/identity/webhooks')).toBe(true);
    expect(routeShowsIdentityBackendMissing('/events/9')).toBe(true);
    expect(routeShowsIdentityBackendMissing('/oauth/new')).toBe(true);
    expect(routeShowsIdentityBackendMissing('/')).toBe(false);
    expect(routeShowsIdentityBackendMissing('/email/templates')).toBe(false);
    expect(routeShowsIdentityBackendMissing('/storage/events')).toBe(false);
    expect(routeShowsIdentityBackendMissing('/hosting/webhooks')).toBe(false);
    expect(routeShowsIdentityBackendMissing('/app/files')).toBe(false);
  });
});
