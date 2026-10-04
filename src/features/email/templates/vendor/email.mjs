/**
 * Shellui email templates written with React Email and Tailwind.
 *
 * Each template (barebone, matte, protocol, arcane, studio) only uses color
 * tokens (`bg-page`, `bg-card`, `text-body`, `bg-primary`, ...). The colors come
 * from the theme palette at render time, so one template works with any theme.
 *
 * This file is shared: `render.mjs` uses it in the email service, and the
 * Shellui admin vendors a byte-identical copy for its live preview
 * (`tools/sync-email-templates.mjs` in shellui/admin). Keep it free of Node
 * APIs and JSX so both sides can load it as plain ESM.
 *
 * Layout, palette, type, and fonts are adapted from the MIT-licensed
 * React Email demos (see themes/LICENSE). Sample copy is not used.
 */
import React from 'react';
import {
  Body,
  Button,
  Container,
  Font,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
  pixelBasedPreset,
} from '@react-email/components';

const h = React.createElement;

export const PALETTE_KEYS = [
  'background',
  'foreground',
  'muted',
  'mutedForeground',
  'primary',
  'primaryForeground',
  'border',
];

const HEX = /^#[0-9a-f]{6}$/i;

/** Template colors, with a complete seven-color palette replacing them. Matches `colors_for` in apps/email/themes.py. */
export function resolveColors(spec, palette) {
  const colors = {
    background: spec.card,
    foreground: spec.foreground,
    muted: spec.page,
    mutedForeground: spec.muted,
    primary: spec.button_bg,
    primaryForeground: spec.button_fg,
    border: spec.border,
    body: spec.body,
    inner: spec.inner,
  };
  const complete =
    palette &&
    PALETTE_KEYS.every((key) => typeof palette[key] === 'string' && HEX.test(palette[key].trim()));
  if (!complete) return colors;
  for (const key of PALETTE_KEYS) colors[key] = palette[key].trim().toLowerCase();
  colors.body = colors.foreground;
  colors.inner = colors.muted;
  return colors;
}

/** Tailwind config for one render: theme colors become utility tokens. */
export function tailwindConfig(spec, colors) {
  return {
    presets: [pixelBasedPreset],
    theme: {
      extend: {
        colors: {
          page: colors.muted,
          card: colors.background,
          inner: colors.inner,
          foreground: colors.foreground,
          body: colors.body,
          muted: colors.mutedForeground,
          primary: colors.primary,
          'primary-foreground': colors.primaryForeground,
          border: colors.border,
        },
        fontFamily: {
          body: [spec.font],
          heading: [spec.heading_font],
        },
      },
    },
  };
}

const SHARED = {
  body: 'm-0 bg-page font-body text-foreground',
  text: 'm-0 mb-4 font-body leading-[1.5] text-body',
  footer: 'm-0 mt-3 font-body text-[12px] leading-[1.5] text-muted',
  heading: 'm-0 mb-4 font-heading leading-[1.2] tracking-[-0.02em] text-foreground',
  button: 'font-body text-[15px] font-medium no-underline',
  list: 'm-0 mb-4 pl-6 text-left font-body leading-[1.5] text-body',
  listItem: 'mb-1',
  divider: 'my-6 border-0 border-t border-solid border-border',
};

const LINK_COLORS = {
  heading: 'text-foreground',
  text: 'text-body',
  footer: 'text-muted',
};

const SAFE_HREF = /^(https?:\/\/|mailto:|tel:)/i;

/** An inline link target, or null when the link renders as plain text. Matches `safe_href` in apps/email/blocks.py. */
export function safeHref(value) {
  const href = String(value || '').trim();
  if (!href) return null;
  if (href.startsWith('{{') || SAFE_HREF.test(href)) return href;
  return null;
}

/** Inline runs of a heading, text, footer, or list item. Matches `block_runs` in apps/email/blocks.py. */
export function blockRuns(block) {
  if (Array.isArray(block.content)) {
    return block.content.filter((run) => run && typeof run.text === 'string');
  }
  return [{ text: String(block.text || '') }];
}

function lineBreaks(text, key) {
  const lines = text.split('\n');
  return lines.flatMap((line, index) =>
    index === 0 ? [line] : [h('br', { key: `${key}-br-${index}` }), line],
  );
}

function runElements(runs, linkColor) {
  return runs.map((run, index) => {
    let node = h(React.Fragment, { key: index }, ...lineBreaks(run.text, index));
    if (run.bold === true) node = h('strong', { key: index }, node);
    if (run.italic === true) node = h('em', { key: index }, node);
    if (run.underline === true) node = h('u', { key: index }, node);
    const href = safeHref(run.href);
    if (href) node = h(Link, { key: index, href, className: `underline ${linkColor}` }, node);
    return node;
  });
}

/** Tailwind classes per template. Colors are tokens only. */
export const TEMPLATES = {
  barebone: {
    container:
      'mx-auto my-8 max-w-[640px] rounded-[10px] border border-solid border-border bg-card p-4',
    inner: 'rounded-[8px] bg-inner px-6 py-7 text-center',
    heading: 'text-[32px] font-semibold',
    text: 'text-[16px]',
    buttonRow: 'mt-2 mb-1 text-center',
    button: 'rounded-[8px] bg-primary px-7 py-4 text-primary-foreground',
  },
  matte: {
    container:
      'mx-auto my-8 max-w-[640px] rounded-[8px] border border-solid border-border bg-card [box-shadow:0_12px_12px_rgba(193,195,193,0.09)]',
    inner: 'rounded-[8px] bg-card px-8 py-10 text-left',
    heading: 'text-[32px] font-medium',
    text: 'text-[14px]',
    buttonRow: 'mt-2 mb-1 text-left',
    button: 'rounded-none bg-primary px-5 py-3.5 text-primary-foreground',
  },
  protocol: {
    container: 'mx-auto my-8 max-w-[640px] bg-card',
    inner: 'bg-card px-8 py-10 text-left',
    heading: 'text-[40px] font-medium uppercase',
    text: 'text-[14px]',
    buttonRow: 'mt-2 mb-1 text-left',
    button: 'rounded-none bg-primary px-5 py-3.5 text-primary-foreground',
  },
  arcane: {
    container: 'mx-auto my-8 max-w-[640px] bg-card',
    inner: 'bg-card px-8 py-10 text-left',
    heading: 'text-[48px] font-normal capitalize',
    text: 'text-[15px]',
    buttonRow: 'mt-2 mb-1 text-left',
    button:
      'rounded-none border border-solid border-foreground bg-transparent px-5 py-3 text-foreground',
  },
  studio: {
    container: 'mx-auto my-8 max-w-[640px] bg-card [box-shadow:0_1px_1px_rgba(22,29,29,0.09)]',
    bar: 'h-2 bg-foreground text-[0px] leading-[0px]',
    inner: 'bg-card px-8 py-10 text-center',
    heading: 'text-[32px] font-medium',
    text: 'text-[14px]',
    buttonRow: 'mt-2 mb-1 text-center',
    button:
      'rounded-[8px] border border-solid border-border bg-primary px-5 py-3 text-primary-foreground [box-shadow:0_1px_1px_rgba(22,29,29,0.09)]',
  },
};

export const DEFAULT_TEMPLATE = 'barebone';

function fontElements(spec) {
  return (spec.fonts || []).map((font, index) =>
    h(Font, {
      key: index,
      fontFamily: font.family,
      fallbackFontFamily: String(font.fallback || 'Arial, sans-serif')
        .split(',')
        .map((part) => part.trim().replace(/^'|'$/g, '')),
      webFont: { url: font.url, format: font.format || 'woff2' },
      fontWeight: font.weight || 400,
      fontStyle: 'normal',
    }),
  );
}

function blockElement(block, index, classes) {
  if (block.type === 'heading') {
    return h(
      Heading,
      { key: index, as: 'h1', className: `${SHARED.heading} ${classes.heading}` },
      ...runElements(blockRuns(block), LINK_COLORS.heading),
    );
  }
  if (block.type === 'list') {
    const items = Array.isArray(block.items) ? block.items.filter((item) => item && typeof item === 'object') : [];
    return h(
      block.ordered === true ? 'ol' : 'ul',
      { key: index, className: `${SHARED.list} ${classes.text}` },
      ...items.map((item, itemIndex) =>
        h(
          'li',
          { key: itemIndex, className: SHARED.listItem },
          ...runElements(blockRuns(item), LINK_COLORS.text),
        ),
      ),
    );
  }
  if (block.type === 'divider') {
    return h(Hr, { key: index, className: SHARED.divider });
  }
  if (block.type === 'button') {
    return h(
      Section,
      { key: index, className: classes.buttonRow },
      h(
        Button,
        { href: block.href || '', className: `${SHARED.button} ${classes.button}` },
        block.text || '',
      ),
    );
  }
  if (block.type === 'footer') {
    return h(
      Text,
      { key: index, className: SHARED.footer },
      ...runElements(blockRuns(block), LINK_COLORS.footer),
    );
  }
  if (block.type !== 'text') return null;
  return h(
    Text,
    { key: index, className: `${SHARED.text} ${classes.text}` },
    ...runElements(blockRuns(block), LINK_COLORS.text),
  );
}

/**
 * The email element tree.
 * `template` is a template key, `spec` its entry in themes.json, `colors` the
 * output of `resolveColors`, and `document` a Shellui block document.
 */
export function createEmail({ template, spec, colors, document }) {
  const classes = TEMPLATES[template] || TEMPLATES[DEFAULT_TEMPLATE];
  const blocks = ((document && document.blocks) || []).filter(
    (block) => block && typeof block === 'object',
  );
  return h(
    Html,
    null,
    h(
      Tailwind,
      { config: tailwindConfig(spec, colors) },
      h(Head, null, ...fontElements(spec)),
      h(
        Body,
        { className: SHARED.body },
        h(Preview, null, (document && document.preview) || ''),
        h(
          Container,
          { className: classes.container },
          classes.bar ? h(Section, { className: classes.bar }, ' ') : null,
          h(
            Section,
            { className: classes.inner },
            ...blocks.map((block, index) => blockElement(block, index, classes)),
          ),
        ),
      ),
    ),
  );
}
