import { afterEach, describe, expect, it, vi } from 'vitest';
import { updateAdminUser, type AdminUserUpdatePayload } from '@/lib/adminUsersApi';

describe('updateAdminUser', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('never sends is_staff or is_superuser', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 3 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await updateAdminUser('tok', 3, {
      is_active: false,
      is_staff: true,
      is_superuser: true,
    } as AdminUserUpdatePayload & { is_staff?: boolean; is_superuser?: boolean });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({ is_active: false });
  });
});
