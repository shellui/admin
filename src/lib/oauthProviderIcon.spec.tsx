import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { OAuthProviderIcon } from '@/components/oauth/OAuthProviderIcon';
import type { OAuthSocialAppRow } from '@/lib/adminOauthClientsApi';
import { resolveSocialAppDocsSlug } from '@/lib/oauthProviderResolve';

vi.mock('@/lib/loadOAuthIcon', () => ({
  hasBundledOAuthIcon: () => true,
  loadOAuthIconSvg: vi.fn().mockResolvedValue('<svg></svg>'),
  OAUTH_ICON_META: {},
}));

function social(
  partial: Partial<OAuthSocialAppRow> & Pick<OAuthSocialAppRow, 'id' | 'provider'>,
): OAuthSocialAppRow {
  return {
    name: partial.provider,
    client_id: 'id',
    is_linked: true,
    mapping_id: 1,
    mapping_is_active: true,
    ...partial,
  };
}

describe('OAuthProviderIcon', () => {
  it('renders the same icon slug for list and edit flows', () => {
    const rows: Array<{ row: OAuthSocialAppRow; expectedSlug: string }> = [
      { row: social({ id: 1, provider: 'google' }), expectedSlug: 'google' },
      { row: social({ id: 2, provider: 'github' }), expectedSlug: 'github' },
      {
        row: social({ id: 3, provider: 'windowslive', allauth_provider: 'windowslive' }),
        expectedSlug: 'microsoft',
      },
      {
        row: social({
          id: 4,
          provider: 'custom-oidc',
          settings: { catalog_slug: 'openid_connect' },
        }),
        expectedSlug: 'openid_connect',
      },
    ];

    for (const { row, expectedSlug } of rows) {
      const docsSlug = resolveSocialAppDocsSlug(row);
      expect(docsSlug).toBe(expectedSlug);

      const list = render(
        <OAuthProviderIcon
          docsSlug={docsSlug}
          title="list"
        />,
      );
      expect(
        list.container
          .querySelector('[data-oauth-icon-slug]')
          ?.getAttribute('data-oauth-icon-slug'),
      ).toBe(expectedSlug);
      list.unmount();

      const edit = render(
        <OAuthProviderIcon
          docsSlug={docsSlug}
          title="edit"
        />,
      );
      expect(
        edit.container
          .querySelector('[data-oauth-icon-slug]')
          ?.getAttribute('data-oauth-icon-slug'),
      ).toBe(expectedSlug);
      edit.unmount();
    }
  });
});
