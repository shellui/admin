// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { renderEmailHtml } from '@/features/email/templates/renderEmail';
import { colorThemePalette } from '@/lib/emailTheme';

const document = {
  preview: 'You have an invitation to {{ company_name }}.',
  blocks: [
    { type: 'heading' as const, text: 'You are invited to {{ company_name }}' },
    { type: 'button' as const, text: 'Open invitation', href: '{{ invitation_url }}' },
  ],
};

describe('renderEmailHtml', () => {
  it('inlines the template colors and keeps placeholders', async () => {
    const html = await renderEmailHtml({ template: 'barebone', palette: {}, document });
    expect(html).toContain('You are invited to {{ company_name }}');
    expect(html).toContain('href="{{ invitation_url }}"');
    expect(html).toContain('background-color:rgb(20,23,30)');
    expect(html).not.toContain('class=');
  });

  it('applies a color theme through the Tailwind tokens', async () => {
    const html = await renderEmailHtml({
      template: 'barebone',
      palette: colorThemePalette('ocean'),
      document,
    });
    expect(html).toContain('background-color:rgb(29,111,216)');
    expect(html).not.toContain('background-color:rgb(20,23,30)');
  });
});
