import { StrictMode, type ReactNode } from 'react';
import { cleanup, render } from '@testing-library/react';
import { Editor } from '@tiptap/core';
import { EditorContext } from '@tiptap/react';
import { SlashCommand } from '@react-email/editor/ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emailDocumentExtensions } from '@/features/email/editor/emailNodes';
import { SlashPluginReset } from '@/features/email/editor/slashPluginReset';

function destroyedEditor() {
  const editor = new Editor({
    element: document.createElement('div'),
    extensions: emailDocumentExtensions(''),
  });
  editor.destroy();
  return editor;
}

function slashPlugins(editor: Editor) {
  return editor.state.plugins.filter((plugin) =>
    (plugin as unknown as { key: string }).key.startsWith('slash-command$'),
  ).length;
}

function mount(editor: Editor, children: ReactNode) {
  render(
    <StrictMode>
      <EditorContext.Provider value={{ editor }}>{children}</EditorContext.Provider>
    </StrictMode>,
  );
}

afterEach(cleanup);

describe('SlashPluginReset', () => {
  it('lets SlashCommand register again on an editor that reports destroyed', () => {
    const editor = destroyedEditor();
    mount(
      editor,
      <>
        <SlashPluginReset editor={editor} />
        <SlashCommand items={[]} />
      </>,
    );
    expect(slashPlugins(editor)).toBe(1);
  });

  it('is needed: SlashCommand alone throws there', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const editor = destroyedEditor();
    expect(() => mount(editor, <SlashCommand items={[]} />)).toThrow(
      'Adding different instances of a keyed plugin (slash-command$)',
    );
    vi.restoreAllMocks();
  });
});
