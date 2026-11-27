import { afterEach, describe, expect, it, vi } from 'vitest';

// Real SDK origin resolution, so the Firefox fallback (no ancestorOrigins) is the SDK's own.
vi.mock('@shellui/sdk', async () => {
  // The SDK entry point reads package.json, which vitest cannot import; the module is standalone.
  const actual = await import('../../node_modules/@shellui/sdk/dist/utils/messageSecurity.js');
  return { resolveParentTargetOrigin: actual.resolveParentTargetOrigin };
});

import { expectedParentOrigin, isParentShellSettingsMessage } from './parentOrigin';

const SELF = 'https://admin.example';
const PARENT = 'https://dashboard.example';

/** An embedded frame whose parent is cross-origin: reading parent.location throws. */
function embeddedFrame(options: { ancestorOrigins?: string[]; referrer: string }) {
  const parent = {
    get location(): Location {
      throw new DOMException('Blocked a frame from accessing a cross-origin frame.');
    },
  };
  const win = { parent, location: { origin: SELF } };
  vi.stubGlobal('window', win);
  vi.stubGlobal('document', {
    referrer: options.referrer,
    location: { ancestorOrigins: options.ancestorOrigins },
  });
  return parent;
}

function event(source: unknown, origin: string): MessageEvent {
  return { source, origin } as unknown as MessageEvent;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('parent origin without ancestorOrigins (Firefox)', () => {
  it('takes the parent origin from the referrer', () => {
    embeddedFrame({ referrer: `${PARENT}/app/page?x=1` });
    expect(expectedParentOrigin()).toBe(PARENT);
  });

  it('fails closed when the referrer is empty', () => {
    const parent = embeddedFrame({ referrer: '' });
    expect(expectedParentOrigin()).toBeNull();
    expect(isParentShellSettingsMessage(event(parent, PARENT))).toBe(false);
  });

  it('fails closed when the referrer is not a URL', () => {
    const parent = embeddedFrame({ referrer: 'not a url' });
    expect(expectedParentOrigin()).toBeNull();
    expect(isParentShellSettingsMessage(event(parent, PARENT))).toBe(false);
  });

  it('fails closed on an opaque referrer origin', () => {
    const parent = embeddedFrame({ referrer: 'data:text/html,hi' });
    expect(expectedParentOrigin()).toBeNull();
    expect(isParentShellSettingsMessage(event(parent, 'null'))).toBe(false);
  });

  it('accepts the parent window at the referrer origin only', () => {
    const parent = embeddedFrame({ referrer: `${PARENT}/` });
    expect(isParentShellSettingsMessage(event(parent, PARENT))).toBe(true);
    expect(isParentShellSettingsMessage(event(parent, 'https://other.example'))).toBe(false);
    expect(isParentShellSettingsMessage(event({}, PARENT))).toBe(false);
  });
});

describe('parent origin with ancestorOrigins (Chromium)', () => {
  it('prefers ancestorOrigins over the referrer', () => {
    const parent = embeddedFrame({ ancestorOrigins: [PARENT], referrer: 'https://spoof.example/' });
    expect(expectedParentOrigin()).toBe(PARENT);
    expect(isParentShellSettingsMessage(event(parent, PARENT))).toBe(true);
  });
});

describe('isParentShellSettingsMessage', () => {
  it('rejects a missing event', () => {
    embeddedFrame({ ancestorOrigins: [PARENT], referrer: '' });
    expect(isParentShellSettingsMessage(undefined)).toBe(false);
  });
});
