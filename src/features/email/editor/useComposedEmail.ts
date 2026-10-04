import { useEffect, useState } from 'react';
import type { EmailDocument } from '@/lib/emailDocument';

/** Composes the email in the browser, debounced. The editor loads on first use. */
export function useComposedEmail(input: {
  document: EmailDocument;
  head: string;
  preheader: string;
}): { html: string | null; failed: boolean } {
  const [html, setHtml] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const key = JSON.stringify(input);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      import('@/features/email/editor/composeEmail')
        .then(({ composeEmailHtml }) => composeEmailHtml(JSON.parse(key)))
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
