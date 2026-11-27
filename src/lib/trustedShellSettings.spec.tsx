import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import shellui from '@shellui/sdk';
import { useShelluiIsStaff } from '@/hooks/useShelluiIsStaff';
import { useShelluiStorage } from '@/hooks/useShelluiStorage';
import { snapshotTrustedShellSettings } from '@/lib/trustedShellSettings';

afterEach(() => {
  cleanup();
});

describe('trusted snapshot readers', () => {
  it('keeps isStaff from the snapshot when live initialSettings are poisoned', () => {
    snapshotTrustedShellSettings({ user: { isStaff: true, id: '1' } });
    shellui.initialSettings = {
      user: { isStaff: false, id: 'attacker' },
    } as typeof shellui.initialSettings;
    const { result } = renderHook(() => useShelluiIsStaff());
    expect(result.current).toBe(true);
  });

  it('keeps storage URLs from the snapshot when live initialSettings are poisoned', () => {
    snapshotTrustedShellSettings({
      storage: { url: 'https://storage.shellui.com', filesUrl: 'https://files.shellui.com' },
    });
    shellui.initialSettings = {
      storage: { url: 'https://evil.example', filesUrl: 'https://evil.example/files' },
    } as typeof shellui.initialSettings;
    const { result } = renderHook(() => useShelluiStorage());
    expect(result.current).toEqual({
      url: 'https://storage.shellui.com',
      filesUrl: 'https://files.shellui.com',
    });
  });
});
