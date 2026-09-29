import { useEffect, type RefObject } from 'react';
import type { EmailEditorRef } from '@react-email/editor';
import { isActionEmailTemplatePlaceholder, validateActionEmailUrl } from '@/lib/actionEmailUrl';

type Editor = NonNullable<EmailEditorRef['editor']>;

type LinkFormKind = 'button' | 'link' | 'image' | 'link-selector';

function resolveLinkForm(form: HTMLFormElement): {
  kind: LinkFormKind;
  input: HTMLInputElement | null;
} | null {
  if (form.hasAttribute('data-re-btn-bm-form')) {
    return {
      kind: 'button',
      input: form.querySelector<HTMLInputElement>('[data-re-btn-bm-input]'),
    };
  }
  if (form.hasAttribute('data-re-link-bm-form')) {
    return {
      kind: 'link',
      input: form.querySelector<HTMLInputElement>('[data-re-link-bm-input]'),
    };
  }
  if (form.hasAttribute('data-re-img-bm-form')) {
    return {
      kind: 'image',
      input: form.querySelector<HTMLInputElement>('[data-re-img-bm-input]'),
    };
  }
  if (form.hasAttribute('data-re-link-selector-form')) {
    return {
      kind: 'link-selector',
      input: form.querySelector<HTMLInputElement>('[data-re-link-selector-input]'),
    };
  }
  return null;
}

function applyHref(editor: Editor, kind: LinkFormKind, href: string): void {
  if (kind === 'button') {
    editor.commands.updateAttributes('button', { href });
    return;
  }
  if (kind === 'image') {
    editor.commands.updateAttributes('image', { href });
    return;
  }
  const { from, to } = editor.state.selection;
  if (from === to) {
    editor.chain().extendMarkRange('link').setMark('link', { href }).run();
  } else {
    editor.chain().setMark('link', { href }).run();
  }
}

/**
 * React Email's bubble-menu URL validator rejects `{{ … }}` placeholders and
 * clears the href to `#`. Capture submit on those forms and apply placeholders
 * ourselves when the stock validator would reject them.
 */
export function useAllowTemplateUrlsInEmailEditor(
  containerRef: RefObject<HTMLElement | null>,
  getEditor: () => Editor | null | undefined,
): void {
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const onSubmit = (event: Event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      const resolved = resolveLinkForm(form);
      if (!resolved) return;

      const raw = (resolved.input?.value ?? '').trim();
      if (!raw || !isActionEmailTemplatePlaceholder(raw)) return;

      const href = validateActionEmailUrl(raw);
      if (!href) return;

      const editor = getEditor();
      if (!editor) return;

      event.preventDefault();
      event.stopPropagation();

      applyHref(editor, resolved.kind, href);
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      editor.commands.focus();
    };

    root.addEventListener('submit', onSubmit, true);
    return () => root.removeEventListener('submit', onSubmit, true);
  }, [containerRef, getEditor]);
}
