import { Editor } from '@tiptap/core';
import { composeReactEmail } from '@react-email/editor/core';
import { emailDocumentExtensions } from '@/features/email/editor/emailNodes';
import type { EmailDocument } from '@/lib/emailDocument';
import { resolveEmailTheme, type EmailThemeColors } from '@/lib/emailThemes';

/** Same HTML email-service stores for a version, before variables are filled. */
export async function composeEmailHtml({
  document,
  head,
  preheader,
  colors,
}: {
  document: EmailDocument;
  head: string;
  preheader: string;
  /** The theme's. Without them a design keeps its own. */
  colors?: EmailThemeColors;
}): Promise<string> {
  const editor = new Editor({
    element: null,
    extensions: emailDocumentExtensions(head),
    content: resolveEmailTheme(document, colors),
  });
  try {
    const { unformattedHtml } = await composeReactEmail({ editor, preview: preheader });
    return unformattedHtml;
  } finally {
    editor.destroy();
  }
}
