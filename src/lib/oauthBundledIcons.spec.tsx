import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { OAuthProviderIcon } from '@/components/oauth/OAuthProviderIcon';
import {
  OAUTH_ICON_FALLBACK_SLUGS,
  OAUTH_ICON_LOADERS,
  OAUTH_ICON_META,
} from '@/assets/oauth-icons/oauthIconManifest';
import { auditInlineSvgTree, auditSvgMarkupIds } from '@/lib/oauthSvgIds';
import { auditSvgMarkupLightVisibility } from '@/lib/oauthIconLightVisibility';
import { prepareOAuthInlineIconSvg } from '@/lib/oauthIconRender';

const ICON_DIR = path.join(process.cwd(), 'src/assets/oauth-icons');

/** Logos known to combine a white foreground mark with a colored background. */
const VISUAL_REGRESSION_SLUGS = ['zoom', 'stripe', 'instagram', 'clever', 'yahoo'] as const;

/** Providers that previously used Lucide before the bundled import pack (PR #29). */
const FORMERLY_MISSING_SLUGS = [
  '23andme',
  'agave',
  'authentiq',
  'battlenet',
  'cern',
  'cilogon',
  'clever',
  'dataporten',
  'daum',
  'dingtalk',
  'doximity',
  'drip',
  'dwolla',
  'edmodo',
  'eveonline',
  'exist',
  'feishu',
  'frontier',
  'jupyterhub',
  'klaviyo',
  'lemonldap',
  'mailcow',
  'netiq',
  'questrade',
  'sharefile',
  'stocktwits',
  'trainingpeaks',
  'wahoo',
  'weibo',
  'weixin',
  'yahoo',
  'yandex',
  'ynab',
] as const;

const bundledMarkups = vi.hoisted(() => new Map<string, string>());

vi.mock('@/lib/loadOAuthIcon', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/loadOAuthIcon')>();
  return {
    ...actual,
    hasBundledOAuthIcon: (slug: string) => bundledMarkups.has(slug),
    loadOAuthIconSvg: async (slug: string) => bundledMarkups.get(slug) ?? null,
  };
});

describe('bundled OAuth SVG assets', () => {
  const svgFiles = readdirSync(ICON_DIR).filter((f) => f.endsWith('.svg'));

  beforeAll(async () => {
    for (const slug of Object.keys(OAUTH_ICON_LOADERS)) {
      const mod = await OAUTH_ICON_LOADERS[slug]();
      bundledMarkups.set(slug, mod.default);
    }
  });

  it('has no Lucide fallback slugs after the import pack', () => {
    expect(OAUTH_ICON_FALLBACK_SLUGS).toEqual([]);
    for (const slug of FORMERLY_MISSING_SLUGS) {
      expect(OAUTH_ICON_LOADERS[slug], slug).toBeDefined();
    }
  });

  it('uses slug-prefixed ids with resolvable references in every file', () => {
    for (const file of svgFiles) {
      const slug = file.replace(/-dark\.svg$/, '').replace(/\.svg$/, '');
      const markup = readFileSync(path.join(ICON_DIR, file), 'utf8');
      const audit = auditSvgMarkupIds(markup);
      expect(audit.duplicateIds, file).toEqual([]);
      expect(audit.brokenReferences, file).toEqual([]);
      if (audit.ids.length > 0) {
        expect(
          audit.ids.every(
            (id) => id.startsWith(`${slug}-`) || id.startsWith(`${slug.replace(/-/g, '_')}-`),
          ),
          file,
        ).toBe(true);
      }
    }
  });

  it('keeps contrasting paint on a light background for full-color bundled icons', () => {
    for (const file of svgFiles) {
      if (file.endsWith('-dark.svg')) continue;
      const slug = file.replace(/-dark\.svg$/, '').replace(/\.svg$/, '');
      const meta = OAUTH_ICON_META[slug];
      if (meta && !meta.fullColor) continue;
      const markup = readFileSync(path.join(ICON_DIR, file), 'utf8');
      const audit = auditSvgMarkupLightVisibility(markup);
      expect(audit.ok, `${file}: ${audit.issue ?? ''}`).toBe(true);
    }
  });

  it('renders every bundled icon twice without cross-SVG id collisions', async () => {
    const slugs = Object.keys(OAUTH_ICON_LOADERS);
    expect(slugs).toEqual(expect.arrayContaining([...VISUAL_REGRESSION_SLUGS]));

    const { container } = render(
      <div>
        {slugs.flatMap((slug) => [
          <OAuthProviderIcon
            key={`${slug}-a`}
            docsSlug={slug}
            title={slug}
          />,
          <OAuthProviderIcon
            key={`${slug}-b`}
            docsSlug={slug}
            title={slug}
          />,
        ])}
      </div>,
    );

    await waitFor(() => {
      expect(container.querySelectorAll('svg').length).toBeGreaterThanOrEqual(slugs.length);
    });

    const audit = auditInlineSvgTree(container);
    expect(audit.duplicateIds).toEqual([]);
    expect(audit.brokenReferences).toEqual([]);
  });

  it('preserves white foreground marks on brand regression icons after instance scoping', () => {
    for (const slug of VISUAL_REGRESSION_SLUGS) {
      const raw = bundledMarkups.get(slug);
      expect(raw, slug).toBeTruthy();
      const scoped = prepareOAuthInlineIconSvg({
        svgMarkup: raw!,
        instancePrefix: 'test-',
        meta: OAUTH_ICON_META[slug],
        colorScheme: 'light',
      });
      const visibility = auditSvgMarkupLightVisibility(scoped);
      expect(visibility.ok, `${slug}: ${visibility.issue ?? ''}`).toBe(true);
      if (slug === 'zoom' || slug === 'stripe' || slug === 'instagram') {
        expect(scoped.toLowerCase()).toMatch(/fill="#fff|fill="#ffffff|fill="white"/);
      }
      if (slug === 'clever' || slug === 'yahoo') {
        expect(scoped).toMatch(/data:image\/png;base64,/);
      }
    }
  });

  it('uses the Stripe brand tile with a white S mark', () => {
    const stripe = readFileSync(path.join(ICON_DIR, 'stripe.svg'), 'utf8');
    expect(stripe).toContain('#635BFF');
    expect(stripe.toLowerCase()).toMatch(/fill="#fff|fill="#ffffff|fill="white"/);
    expect(stripe).not.toContain('533afd');
  });
});
