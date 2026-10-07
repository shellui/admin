import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { EmailThemeSelect } from '@/features/email/components/EmailThemeSelect';
import type { EmailTheme } from '@/lib/emailThemes';

const ocean: EmailTheme = { name: 'ocean', label: 'Ocean', colors: { primary: '#0a66c2' } };
const forest: EmailTheme = { name: 'forest', label: 'Forest', colors: { primary: '#14532d' } };

function renderSelect(value: EmailTheme | null, onChange = vi.fn()) {
  render(
    <I18nextProvider i18n={i18n}>
      <EmailThemeSelect
        value={value}
        themes={[ocean, forest]}
        designColors={{ primary: 'rgb(20,23,30)' }}
        onChange={onChange}
      />
    </I18nextProvider>,
  );
  return onChange;
}

describe('EmailThemeSelect', () => {
  afterEach(cleanup);

  it('shows each theme as a preview card and picks one', () => {
    const onChange = renderSelect(null);
    const trigger = screen.getByRole('button', { name: 'Email theme' });
    expect(trigger.textContent).toContain('Template colors');
    fireEvent.click(trigger);

    const options = screen.getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual([
      'Template colors',
      'Ocean',
      'Forest',
    ]);
    expect(options[0].getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(options[0]);
    expect(options[1].innerHTML).toContain('rgb(10, 102, 194)');

    fireEvent.click(options[2]);
    expect(onChange).toHaveBeenCalledWith(forest);
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('moves with the arrow keys and closes on Escape or outside clicks', () => {
    const onChange = renderSelect(ocean);
    fireEvent.click(screen.getByRole('button', { name: 'Email theme' }));
    const options = screen.getAllByRole('option');
    expect(document.activeElement).toBe(options[1]);
    fireEvent.keyDown(options[1], { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(options[0]);
    fireEvent.keyDown(options[0], { key: 'End' });
    expect(document.activeElement).toBe(options[2]);
    fireEvent.keyDown(options[2], { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Email theme' }));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps a saved theme that is no longer offered', () => {
    renderSelect({ name: 'retired', label: 'Retired', colors: { primary: '#123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Email theme' }));
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Template colors',
      'Retired',
      'Ocean',
      'Forest',
    ]);
  });
});
