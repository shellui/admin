#!/usr/bin/env node
/**
 * Downloads OAuth provider SVGs into src/assets/oauth-icons/ and regenerates manifest + NOTICE.
 * Run: node tools/sync-oauth-icons.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { optimize } from 'svgo';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'src/assets/oauth-icons');
const CATALOG_PATH =
  process.env.OAUTH_CATALOG_JSON ||
  '/home/ubuntu/.cursor/projects/workspace/uploads/providers_fa5d.json';

/** docs_slug -> SVGL title (exact) or special source key */
const SIMPLE_ICON_ALIASES = {
  battlenet: 'battledotnet',
  bitbucket: 'bitbucket',
  dingtalk: 'alibabadotcom',
  draugiem: 'draugiemdotlv',
  weibo: 'sinaweibo',
  weixin: 'wechat',
  vimeo_oauth2: 'vimeo',
  tumblr_oauth2: 'tumblr',
  fxa: 'firefox',
  windowslive: 'microsoft',
};

const SLUG_TITLE = {
  google: 'Google',
  microsoft: 'Microsoft',
  linkedin: 'LinkedIn',
  slack: 'Slack',
  twitter: 'X (formerly Twitter)',
  twitter_oauth2: 'X (formerly Twitter)',
  windowslive: 'Microsoft',
  amazon_cognito: 'Amazon Web Services',
  stackexchange: 'Stack Overflow',
  tumblr_oauth2: 'Tumblr',
  weixin: 'WeChat',
  fxa: 'Firefox',
  bitbucket: 'Bitbucket',
  draugiem: 'Draugiem.lv',
  soundcloud: 'SoundCloud',
  edx: 'edX',
};

const PROTOCOL_SVGS = {
  oauth2: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img"><path fill="#4285F4" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 2.2c1.6 0 3 .5 4.1 1.4l-1.7 1.7A4.6 4.6 0 0 0 12 6.4c-1.5 0-2.8.7-3.7 1.8L6.5 6.6A6.8 6.8 0 0 1 12 4.2Z"/><path fill="#34A853" d="M19.8 10.2c.1.6.2 1.2.2 1.8s-.1 1.2-.2 1.8l-2.3-.3c0-.5.1-1 .1-1.5s-.1-1-.1-1.5l2.3-.3Z"/><path fill="#FBBC05" d="M12 17.6c-1.5 0-2.8-.7-3.7-1.8l-1.8 1.8c1.4 1.3 3.2 2.1 5.5 2.1 1.6 0 3-.5 4.1-1.4l-1.7-1.7c-.7.5-1.6.8-2.4.8Z"/><path fill="#EA4335" d="M6.5 6.6 8.3 8.4A4.6 4.6 0 0 0 6.4 12c0 .5.1 1 .2 1.5L4.3 13.8C4.1 13.2 4 12.6 4 12s.1-1.2.3-1.8l2.2.4Z"/></svg>`,
  openid: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img"><circle cx="12" cy="12" r="10" fill="#F7931E"/><text x="12" y="16" text-anchor="middle" font-family="Arial,sans-serif" font-size="8" font-weight="700" fill="#fff">OpenID</text></svg>`,
  openid_connect: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img"><rect width="24" height="24" rx="4" fill="#F07800"/><text x="12" y="10" text-anchor="middle" font-family="Arial,sans-serif" font-size="5" font-weight="700" fill="#fff">OIDC</text><text x="12" y="16" text-anchor="middle" font-family="Arial,sans-serif" font-size="4" fill="#fff">Connect</text></svg>`,
  saml: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img"><rect width="24" height="24" rx="4" fill="#C0392B"/><text x="12" y="15" text-anchor="middle" font-family="Arial,sans-serif" font-size="7" font-weight="700" fill="#fff">SAML</text></svg>`,
};

/** Slugs that use a dark-theme alternate SVG file ({slug}-dark.svg). */
const DARK_ALT_FROM_SVGL = new Set(['twitter', 'twitter_oauth2']);

/** Monochrome logos: invert in dark theme for legibility. */
const INVERT_ON_DARK = new Set(['github', 'twitter', 'twitter_oauth2', 'x']);

const SVGO_CONFIG = {
  multipass: true,
  plugins: [
    'preset-default',
    { name: 'removeViewBox', active: false },
    { name: 'removeDimensions', active: true },
  ],
};

function routeOf(entry) {
  if (!entry) return { light: null, dark: null };
  const r = entry.route;
  if (typeof r === 'string') return { light: r, dark: null };
  if (r && typeof r === 'object') {
    return { light: r.light || null, dark: r.dark || null };
  }
  return { light: null, dark: null };
}

function svgoOptimize(svg) {
  return optimize(svg, SVGO_CONFIG).data;
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function main() {
  const catalog = JSON.parse(await fs.readFile(CATALOG_PATH, 'utf8'));
  const svglCache = path.join(__dirname, '.svgl-cache.json');
  let svglRaw;
  try {
    svglRaw = await fetchText('https://api.svgl.app');
    await fs.writeFile(svglCache, svglRaw);
  } catch {
    svglRaw = await fs.readFile(svglCache, 'utf8');
  }
  const svgl = JSON.parse(svglRaw);
  const byTitle = new Map(svgl.map((x) => [x.title.toLowerCase(), x]));

  await fs.mkdir(OUT_DIR, { recursive: true });

  const manifest = [];
  const notice = [];
  const fallbacks = [];

  for (const prov of catalog) {
    const slug = prov.docs_slug;
    if (prov.supported === false || prov.legacy) continue;

    const title = SLUG_TITLE[slug] || prov.name;
    let source = 'SVGL (https://svgl.app, MIT)';
    let license = 'MIT';
    let lightSvg = null;
    let darkSvg = null;
    let entry = null;

    if (PROTOCOL_SVGS[slug]) {
      lightSvg = PROTOCOL_SVGS[slug];
      source = 'Shellui (generated protocol mark, CC0-1.0)';
      license = 'CC0-1.0';
    } else {
      entry = byTitle.get(String(title).toLowerCase());
      if (!entry) {
        entry = svgl.find((x) => x.title.toLowerCase() === String(title).toLowerCase());
      }
      if (!entry) {
        const norm = slug
          .replace(/_/g, ' ')
          .replace(/oauth2$/, '')
          .trim();
        entry = svgl.find(
          (x) =>
            x.title.toLowerCase() === norm ||
            x.title.toLowerCase().replace(/\s+/g, '') === norm.replace(/\s+/g, ''),
        );
      }
      const routes = routeOf(entry);
      if (routes.light) {
        try {
          lightSvg = await fetchText(routes.light);
          if (routes.dark) darkSvg = await fetchText(routes.dark);
        } catch (e) {
          console.warn('SVGL fetch failed', slug, e.message);
        }
      }
      if (!lightSvg) {
        const siCandidates = [
          SIMPLE_ICON_ALIASES[slug],
          slug,
          slug.replace(/_/g, ''),
          slug.replace(/_oauth2$/, ''),
        ].filter(Boolean);
        for (const candidate of siCandidates) {
          const siPath = path.join(ROOT, 'node_modules/simple-icons/icons', `${candidate}.svg`);
          try {
            lightSvg = await fs.readFile(siPath, 'utf8');
            source = 'simple-icons (https://simpleicons.org, CC0-1.0)';
            license = 'CC0-1.0';
            break;
          } catch {
            /* try next */
          }
        }
      }
    }

    if (!lightSvg) {
      fallbacks.push(slug);
      continue;
    }

    lightSvg = svgoOptimize(lightSvg);
    const file = `${slug}.svg`;
    await fs.writeFile(path.join(OUT_DIR, file), lightSvg);

    let darkFile = null;
    if (darkSvg || DARK_ALT_FROM_SVGL.has(slug)) {
      if (!darkSvg && entry) {
        const darkRoute = routeOf(entry).dark;
        if (darkRoute) {
          try {
            darkSvg = svgoOptimize(await fetchText(darkRoute));
          } catch {
            /* ignore */
          }
        }
      }
      if (darkSvg) {
        darkFile = `${slug}-dark.svg`;
        await fs.writeFile(path.join(OUT_DIR, darkFile), svgoOptimize(darkSvg));
      }
    }

    const fullColor = !INVERT_ON_DARK.has(slug) && slug !== 'github';
    manifest.push({
      slug,
      file,
      darkFile,
      fullColor: fullColor || ['google', 'microsoft', 'slack', 'linkedin'].includes(slug),
      invertOnDark: INVERT_ON_DARK.has(slug),
      source,
      license,
    });
    notice.push(`- \`${file}\` (${slug}): ${source}, ${license}`);
  }

  await fs.writeFile(
    path.join(OUT_DIR, 'NOTICE.md'),
    `# OAuth provider icons\n\nBundled SVG logos for the Shellui admin OAuth setup wizard.\n\n## Attribution\n\n${notice.join('\n')}\n\n## Fallback\n\nProviders without an entry above use a Lucide icon in the UI: ${fallbacks.length ? fallbacks.join(', ') : 'none'}.\n`,
  );

  const loaderLines = manifest
    .map((m) => `  ${JSON.stringify(m.slug)}: () => import('./${m.file}?raw'),`)
    .join('\n');
  const darkLoaderLines = manifest
    .filter((m) => m.darkFile)
    .map((m) => `  ${JSON.stringify(m.slug)}: () => import('./${m.darkFile}?raw'),`)
    .join('\n');

  const metaEntries = manifest
    .map(
      (m) =>
        `  ${JSON.stringify(m.slug)}: { fullColor: ${m.fullColor}, invertOnDark: ${m.invertOnDark}, source: ${JSON.stringify(m.source)}, license: ${JSON.stringify(m.license)} },`,
    )
    .join('\n');

  await fs.writeFile(
    path.join(OUT_DIR, 'oauthIconManifest.ts'),
    `/** Generated by tools/sync-oauth-icons.mjs — do not edit by hand. */\n\nexport type OAuthIconMeta = {\n  fullColor: boolean;\n  invertOnDark: boolean;\n  source: string;\n  license: string;\n};\n\nexport const OAUTH_ICON_META: Record<string, OAuthIconMeta> = {\n${metaEntries}\n};\n\nexport const OAUTH_ICON_LOADERS: Record<string, () => Promise<{ default: string }>> = {\n${loaderLines}\n};\n\nexport const OAUTH_ICON_DARK_LOADERS: Record<string, () => Promise<{ default: string }>> = {\n${darkLoaderLines}\n};\n\nexport const OAUTH_ICON_FALLBACK_SLUGS: readonly string[] = ${JSON.stringify(fallbacks)} as const;\n`,
  );

  console.log('Icons:', manifest.length, 'Fallbacks:', fallbacks.length, fallbacks);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
