import { describe, expect, it } from 'vitest';
import {
  DESKTOP_SIGN_IN_DEEP_LINK_PLACEHOLDER,
  desktopRedirectSchemeIssue,
  desktopSignInDeepLink,
} from '@/lib/desktopRedirectScheme';

describe('desktopRedirectSchemeIssue', () => {
  it('treats an empty value as desktop sign-in off', () => {
    expect(desktopRedirectSchemeIssue('')).toBeNull();
    expect(desktopRedirectSchemeIssue('   ')).toBeNull();
  });

  it('accepts a lowercase RFC 3986 scheme', () => {
    expect(desktopRedirectSchemeIssue('shellui-playground')).toBeNull();
    expect(desktopRedirectSchemeIssue('com.example.desktop')).toBeNull();
    expect(desktopRedirectSchemeIssue(' app+v1 ')).toBeNull();
  });

  it('rejects uppercase before the shape check', () => {
    expect(desktopRedirectSchemeIssue('Shellui-Playground')).toBe('lowercase');
    expect(desktopRedirectSchemeIssue('HTTP')).toBe('lowercase');
  });

  it('rejects a scheme that is not RFC 3986', () => {
    expect(desktopRedirectSchemeIssue('1app')).toBe('shape');
    expect(desktopRedirectSchemeIssue('my_app')).toBe('shape');
    expect(desktopRedirectSchemeIssue(`${'a'.repeat(65)}`)).toBe('shape');
  });

  it('rejects browser, network, and web+ schemes', () => {
    for (const scheme of [
      'http',
      'https',
      'javascript',
      'data',
      'file',
      'vbscript',
      'about',
      'blob',
      'ftp',
      'mailto',
      'ws',
    ]) {
      expect(desktopRedirectSchemeIssue(scheme)).toBe('denied');
    }
    expect(desktopRedirectSchemeIssue('web+myapp')).toBe('denied');
  });
});

describe('desktopSignInDeepLink', () => {
  it('shows the placeholder until the scheme is valid', () => {
    expect(desktopSignInDeepLink('')).toBe(DESKTOP_SIGN_IN_DEEP_LINK_PLACEHOLDER);
    expect(desktopSignInDeepLink('HTTP')).toBe(DESKTOP_SIGN_IN_DEEP_LINK_PLACEHOLDER);
  });

  it('builds the callback deep link from a valid scheme', () => {
    expect(desktopSignInDeepLink(' shellui-playground ')).toBe('shellui-playground://callback');
  });
});
