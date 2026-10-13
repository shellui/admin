import { afterEach, describe, expect, it, vi } from 'vitest';
import { CompanyFieldError, fetchMemberCompanies, patchCompany } from '@/lib/companiesApi';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const company = {
  id: 7,
  name: 'Acme',
  slug: 'acme',
  owners: [4],
  access_mode: 'public',
  allowed_email_domains: [],
  desktop_redirect_schemes: ['shellui-playground'],
};

describe('company desktop_redirect_schemes', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads the field on the company object and defaults a missing list to empty', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse([
          company,
          {
            id: 8,
            name: 'Other',
            slug: 'other',
            owners: [],
            access_mode: 'public',
            allowed_email_domains: [],
          },
        ]),
      ),
    );

    const rows = await fetchMemberCompanies('tok');
    expect(rows[0]?.desktop_redirect_schemes).toEqual(['shellui-playground']);
    expect(rows[1]?.desktop_redirect_schemes).toEqual([]);
  });

  it('patches the scheme list and surfaces a field error', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PATCH' && String(init.body).includes('shellui-playground')) {
        return jsonResponse({ ...company, desktop_redirect_schemes: ['shellui-playground'] });
      }
      return jsonResponse({ desktop_redirect_schemes: ['Scheme must be lowercase.'] }, 400);
    });
    vi.stubGlobal('fetch', fetchMock);

    const updated = await patchCompany('tok', 7, {
      desktop_redirect_schemes: ['shellui-playground'],
    });
    expect(updated.desktop_redirect_schemes).toEqual(['shellui-playground']);
    const okInit = fetchMock.mock.calls[0]?.[1];
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/companies/7/');
    expect(okInit?.method).toBe('PATCH');
    expect(JSON.parse(String(okInit?.body))).toEqual({
      desktop_redirect_schemes: ['shellui-playground'],
    });

    await expect(patchCompany('tok', 7, { desktop_redirect_schemes: [] })).rejects.toMatchObject({
      name: 'CompanyFieldError',
      fieldErrors: { desktop_redirect_schemes: 'Scheme must be lowercase.' },
    });
    await expect(patchCompany('tok', 7, { desktop_redirect_schemes: [] })).rejects.toBeInstanceOf(
      CompanyFieldError,
    );
  });
});
