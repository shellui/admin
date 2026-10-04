import { useEffect, useState } from 'react';
import type { EmailDocument } from '@/lib/emailDocument';

/** Renders the email in the browser, debounced. React Email loads on first use. */
export function useRenderedEmail(input: {
  template: string;
  palette: Record<string, string> | null;
  document: EmailDocument;
}): { html: string | null; failed: boolean } {
  const [html, setHtml] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const key = JSON.stringify(input);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      import('@/features/email/templates/renderEmail')
        .then(({ renderEmailHtml }) => renderEmailHtml(JSON.parse(key)))
        .then((next) => {
          if (cancelled) return;
          setHtml(next);
          setFailed(false);
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key]);

  return { html, failed };
}
