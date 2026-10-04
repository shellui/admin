import type { ReactElement } from 'react';

export type TemplateFont = {
  family: string;
  fallback?: string;
  url: string;
  format?: string;
  weight?: number;
};

/** One entry of themes.json. */
export type TemplateSpec = {
  name: string;
  page: string;
  card: string;
  inner: string;
  foreground: string;
  body: string;
  muted: string;
  button_bg: string;
  button_fg: string;
  border: string;
  font: string;
  heading_font: string;
  fonts?: TemplateFont[];
  [key: string]: unknown;
};

export type TemplateColors = {
  background: string;
  foreground: string;
  muted: string;
  mutedForeground: string;
  primary: string;
  primaryForeground: string;
  border: string;
  body: string;
  inner: string;
};

export type TemplateRun = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  href?: string;
};

export type TemplateDocument = {
  preview?: string;
  blocks?: Array<{
    type: string;
    text?: string;
    href?: string;
    content?: TemplateRun[];
    ordered?: boolean;
    items?: Array<{ text?: string; content?: TemplateRun[] }>;
  }>;
};

export const PALETTE_KEYS: readonly string[];
export const DEFAULT_TEMPLATE: string;
export const TEMPLATES: Record<string, Record<string, string>>;

export function safeHref(value: unknown): string | null;

export function blockRuns(block: { text?: string; content?: TemplateRun[] }): TemplateRun[];

export function resolveColors(
  spec: TemplateSpec,
  palette?: Record<string, string> | null,
): TemplateColors;

export function tailwindConfig(spec: TemplateSpec, colors: TemplateColors): Record<string, unknown>;

export function createEmail(input: {
  template: string;
  spec: TemplateSpec;
  colors: TemplateColors;
  document: TemplateDocument;
}): ReactElement;
