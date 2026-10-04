import type { TemplateSpec } from './vendor/email.mjs';
import catalog from './vendor/themes.json';

export const TEMPLATE_SPECS = catalog as unknown as Record<string, TemplateSpec>;

export const TEMPLATE_CHOICES = Object.entries(TEMPLATE_SPECS).map(([key, spec]) => ({
  key,
  name: spec.name,
}));
