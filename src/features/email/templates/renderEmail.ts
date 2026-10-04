import { render } from '@react-email/render';
import type { EmailDocument } from '@/lib/emailDocument';
import { TEMPLATE_SPECS } from './catalog';
import { DEFAULT_TEMPLATE, createEmail, resolveColors } from './vendor/email.mjs';

/** Same React Email tree as the service renderer, rendered in the browser. */
export async function renderEmailHtml(input: {
  template: string;
  palette: Record<string, string> | null;
  document: EmailDocument;
}): Promise<string> {
  const key = input.template in TEMPLATE_SPECS ? input.template : DEFAULT_TEMPLATE;
  const spec = TEMPLATE_SPECS[key];
  return render(
    createEmail({
      template: key,
      spec,
      colors: resolveColors(spec, input.palette),
      document: input.document,
    }),
  );
}
