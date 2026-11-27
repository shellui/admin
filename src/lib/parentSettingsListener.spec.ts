import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({
  listeners: [] as { type: string; fn: (message: unknown, event: unknown) => void }[],
  origin: 'https://shell.example' as string | null,
}));

vi.mock('@shellui/sdk', () => ({
  addMessageListener: (type: string, fn: (message: unknown, event: unknown) => void) => {
    const entry = { type, fn };
    sdk.listeners.push(entry);
    return () => {
      const index = sdk.listeners.indexOf(entry);
      if (index >= 0) sdk.listeners.splice(index, 1);
    };
  },
  resolveParentTargetOrigin: () => sdk.origin,
}));

import { addParentSettingsListener } from './parentSettingsListener';

function emit(type: string, event: unknown) {
  for (const entry of [...sdk.listeners]) {
    if (entry.type === type) entry.fn({ type, payload: {} }, event);
  }
}

afterEach(() => {
  sdk.listeners.splice(0);
  sdk.origin = 'https://shell.example';
});

describe('addParentSettingsListener', () => {
  it('subscribes to both settings events and unsubscribes both', () => {
    const off = addParentSettingsListener(vi.fn());
    expect(sdk.listeners.map((l) => l.type).sort()).toEqual([
      'SHELLUI_SETTINGS',
      'SHELLUI_SETTINGS_UPDATED',
    ]);
    off();
    expect(sdk.listeners).toHaveLength(0);
  });

  it.each(['SHELLUI_SETTINGS', 'SHELLUI_SETTINGS_UPDATED'])(
    'runs the handler for the parent on %s only',
    (type) => {
      const handler = vi.fn();
      addParentSettingsListener(handler);
      emit(type, { source: {}, origin: 'https://shell.example' });
      emit(type, { source: window.parent, origin: 'https://child.example' });
      emit(type, undefined);
      expect(handler).not.toHaveBeenCalled();

      emit(type, { source: window.parent, origin: 'https://shell.example' });
      expect(handler).toHaveBeenCalledTimes(1);
    },
  );

  it('fails closed when the parent origin is unknown', () => {
    sdk.origin = null;
    const handler = vi.fn();
    addParentSettingsListener(handler);
    emit('SHELLUI_SETTINGS', { source: window.parent, origin: 'https://shell.example' });
    emit('SHELLUI_SETTINGS', { source: window.parent, origin: 'null' });
    expect(handler).not.toHaveBeenCalled();
  });
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) && !/\.spec\.tsx?$/.test(name) ? [full] : [];
  });
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('settings listeners go through the shared helper', () => {
  it('no source file outside the helper subscribes to SHELLUI_SETTINGS or SHELLUI_SETTINGS_UPDATED', () => {
    const helper = path.resolve(__dirname, 'parentSettingsListener.ts');
    const offenders = sourceFiles(path.resolve(__dirname, '..'))
      .filter((file) => file !== helper)
      .filter((file) => {
        const code = stripComments(readFileSync(file, 'utf8'));
        const names = /['"`]SHELLUI_SETTINGS(_UPDATED)?['"`]/.test(code);
        const listens = /addMessageListener/.test(code);
        return names && listens;
      })
      .map((file) => path.relative(path.resolve(__dirname, '../..'), file));
    expect(offenders).toEqual([]);
  });

  it('would catch a direct subscription (the scan itself works)', () => {
    const bad = stripComments(`shellui.addMessageListener('SHELLUI_SETTINGS', apply);`);
    expect(
      /['"`]SHELLUI_SETTINGS(_UPDATED)?['"`]/.test(bad) && /addMessageListener/.test(bad),
    ).toBe(true);
    const commentOnly = stripComments(`// addMessageListener('SHELLUI_SETTINGS')`);
    expect(/addMessageListener/.test(commentOnly)).toBe(false);
  });
});
