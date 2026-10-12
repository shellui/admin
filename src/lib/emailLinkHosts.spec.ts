import { describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import {
  LINK_HOST_ERROR_CODES,
  MAX_EXTRA_LINK_HOSTS,
  classifyExtraHost,
  parseExtraHosts,
} from '@/lib/emailLinkHosts';

describe('classifyExtraHost', () => {
  it('accepts an exact hostname and lowercases it', () => {
    expect(classifyExtraHost('  APP.Example.COM ')).toEqual({ host: 'app.example.com' });
    expect(classifyExtraHost('localhost')).toEqual({ host: 'localhost' });
  });

  it.each([
    ['https://playground.shellui.com', 'scheme_not_allowed'],
    ['//playground.shellui.com', 'scheme_not_allowed'],
    ['playground.shellui.com/login', 'path_not_allowed'],
    ['playground.shellui.com?q=1', 'path_not_allowed'],
    ['not a host', 'path_not_allowed'],
    ['playground.shellui.com:443', 'port_not_allowed'],
    ['*.shellui.com', 'wildcard_not_allowed'],
    ['.shellui.com', 'wildcard_not_allowed'],
    ['1.2.3.4', 'ip_not_allowed'],
    ['127.0.0.1', 'ip_not_allowed'],
    ['::1', 'ip_not_allowed'],
    ['[::1]', 'ip_not_allowed'],
    ['127.000.000.001', 'ip_not_allowed'],
    ['0x7f.0.0.1', 'ip_not_allowed'],
    ['', 'invalid_hostname'],
    ['example', 'invalid_hostname'],
    ['user@app.example.com', 'invalid_hostname'],
    ['app.example.com.', 'invalid_hostname'],
  ] as const)('rejects %j as %s', (raw, code) => {
    expect(classifyExtraHost(raw)).toEqual({ code });
  });
});

describe('parseExtraHosts', () => {
  it('sorts and drops duplicates', () => {
    expect(
      parseExtraHosts(['Playground.shellui.com', 'app.example.com', 'playground.shellui.com']),
    ).toEqual({
      hosts: ['app.example.com', 'playground.shellui.com'],
    });
  });

  it('rejects a list that is too long and a value that is not a list', () => {
    const hosts = Array.from(
      { length: MAX_EXTRA_LINK_HOSTS + 1 },
      (_, index) => `app${index}.example.com`,
    );
    expect(parseExtraHosts(hosts)).toEqual({ code: 'too_many' });
    expect(parseExtraHosts('app.example.com')).toEqual({ code: 'invalid' });
  });
});

describe('link host error strings', () => {
  it('has an EN and FR sentence for every rejection code', () => {
    for (const lng of ['en', 'fr'] as const) {
      for (const code of LINK_HOST_ERROR_CODES) {
        const key = `emailLinkHostError_${code}`;
        expect(i18n.exists(key, { lng }), `${lng}:${key}`).toBe(true);
        const value = i18n.t(key, { lng });
        expect(value, `${lng}:${key}`).not.toMatch(/[—–]/);
      }
    }
  });
});
