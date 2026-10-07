import { useEffect } from 'react';
import type { Editor } from '@tiptap/core';

const SLASH_PLUGIN = 'slash-command$';

/**
 * `SlashCommand` registers its keyed plugin in an effect but cannot unregister
 * it once the editor reports destroyed, so its next register throws "Adding
 * different instances of a keyed plugin". Render this just before it: sibling
 * effects run in order, so a leftover plugin is gone before it registers again.
 */
export function SlashPluginReset({ editor }: { editor: Editor }) {
  useEffect(() => {
    const { plugins } = editor.state;
    const kept = plugins.filter(
      (plugin) => (plugin as unknown as { key: string }).key !== SLASH_PLUGIN,
    );
    if (kept.length !== plugins.length) {
      editor.view.updateState(editor.state.reconfigure({ plugins: kept }));
    }
  }, [editor]);
  return null;
}
