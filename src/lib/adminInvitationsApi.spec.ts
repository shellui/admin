import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AdminApiError,
  deleteAdminInvitation,
  fetchAdminInvitations,
  inviteAdminUser,
  revokeAdminInvitation,
} from '@/lib/adminUsersApi';

function mockFetch(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const invitation = {
  id: 7,
  email: 'ada@acme.com',
  language: 'fr',
  status: 'pending',
  invited_by: null,
  created_at: '2026-10-01T10:00:00+00:00',
  revoked_at: null,
};

describe('invitation API', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists open invitations', async () => {
    const fetchMock = mockFetch(200, { results: [invitation] });
    await expect(fetchAdminInvitations('tok')).resolves.toEqual([invitation]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:8000/api/v1/invitations');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer tok');
  });

  it('creates an invitation and returns it', async () => {
    const fetchMock = mockFetch(201, { invitation });
    await expect(
      inviteAdminUser('tok', { email: 'ada@acme.com', language: 'fr' }),
    ).resolves.toEqual(invitation);
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
  });

  it('revokes with POST on the revoke action', async () => {
    const fetchMock = mockFetch(200, { invitation: { ...invitation, status: 'revoked' } });
    const result = await revokeAdminInvitation('tok', 7);
    expect(result.status).toBe('revoked');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:8000/api/v1/invitations/7/revoke');
    expect(init.method).toBe('POST');
  });

  it('deletes with DELETE on the invitation id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(deleteAdminInvitation('tok', 7)).resolves.toBeUndefined();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:8000/api/v1/invitations/7');
    expect(init.method).toBe('DELETE');
  });

  it('exposes the server error code', async () => {
    mockFetch(409, {
      error: 'An invitation is already pending for this email.',
      error_code: 'already_invited',
    });
    const error = await inviteAdminUser('tok', { email: 'ada@acme.com', language: 'en' }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(AdminApiError);
    expect((error as AdminApiError).code).toBe('already_invited');
    expect((error as AdminApiError).message).toBe(
      'An invitation is already pending for this email.',
    );
  });
});
