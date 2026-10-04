import { Editor } from '@tiptap/core';
import { composeReactEmail } from '@react-email/editor/core';
import { emailDocumentExtensions } from '@/features/email/editor/emailNodes';
import type { EmailDocument } from '@/lib/emailDocument';

/** Same HTML email-service stores for a version, before variables are filled. */
export async function composeEmailHtml({
  document,
  head,
  preheader,
}: {
  document: EmailDocument;
  head: string;
  preheader: string;
}): Promise<string> {
  const editor = new Editor({
    element: null,
    extensions: emailDocumentExtensions(head),
    content: document,
  });
  try {
    const { unformattedHtml } = await composeReactEmail({ editor, preview: preheader });
    return unformattedHtml;
  } finally {
    editor.destroy();
  }
}
