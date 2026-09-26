import { describe, expect, it } from 'vitest';
import { formatDocumentAsReactDebugSource } from '@/lib/actionEmailDocumentDebug';

describe('actionEmailDocumentDebug', () => {
  it('formats doc nodes as pseudo JSX', () => {
    const out = formatDocumentAsReactDebugSource({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello' }],
        },
      ],
    });
    expect(out).toContain('ActionEmailDebugView');
    expect(out).toContain('Hello');
    expect(out).toContain('Read-only debug view');
  });
});
