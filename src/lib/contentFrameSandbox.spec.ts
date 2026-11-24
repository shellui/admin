import { describe, expect, it } from 'vitest';
import { resolveContentIframeSandbox } from '@shellui/core/contentIframeSandbox';

// Admin chrome hosts its own hash pages in a same-origin ContentView iframe.
// The nested frame needs allow-same-origin so isAdminContentFrame() can read
// window.parent.location and render the page instead of a second sidebar.
describe('core content iframe sandbox for admin content frames', () => {
  it('keeps allow-same-origin for a same-origin admin hash page', () => {
    const origin = 'https://admin.example.com';
    const sandbox = resolveContentIframeSandbox(`${origin}/#/agents`, origin);
    expect(sandbox.split(' ')).toContain('allow-same-origin');
  });
});
