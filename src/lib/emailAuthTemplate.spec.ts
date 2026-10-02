import { describe, expect, it } from 'vitest';
import { validateAuthLaneOverride } from '@/lib/emailAuthTemplate';
import type { EmailDocument, EmailVariable } from '@/lib/emailDocument';

const variables: EmailVariable[] = [
  {
    token: 'magic_link_url',
    type: 'url',
    required: true,
    description: '',
    example: 'https://id.shellui.com/verify',
    isUrl: true,
    allowedHostsSetting: 'EMAIL_AUTH_LINK_HOSTS',
  },
  {
    token: 'company_name',
    type: 'string',
    required: true,
    description: '',
    example: 'Acme',
    isUrl: false,
  },
];

function document(href: string): EmailDocument {
  return {
    preview: 'Sign in',
    blocks: [
      { type: 'text', text: 'Use {{ magic_link_url }}' },
      { type: 'button', text: 'Sign in', href },
    ],
  };
}

describe('validateAuthLaneOverride', () => {
  it('accepts the magic link variable on an auth button', () => {
    expect(
      validateAuthLaneOverride({
        laneClass: 'auth',
        variables,
        subject: 'Sign in',
        preheader: '',
        document: document('{{ magic_link_url }}'),
      }),
    ).toBeNull();
  });

  it('accepts an https button href on the exposed allowlist', () => {
    expect(
      validateAuthLaneOverride({
        laneClass: 'auth',
        variables,
        authLinkHosts: ['id.shellui.com'],
        subject: 'Sign in {{ magic_link_url }}',
        preheader: '',
        document: document('https://id.shellui.com/api/v1/magic-link/verify'),
      }),
    ).toBeNull();
  });

  it('rejects a button host that is not on auth_link_hosts', () => {
    const issue = validateAuthLaneOverride({
      laneClass: 'auth',
      variables,
      authLinkHosts: ['id.shellui.com'],
      subject: '{{ magic_link_url }}',
      preheader: '',
      document: document('https://evil.example/phish'),
    });
    expect(issue?.errorCode).toBe('auth_link_host_not_allowed');
  });

  it('rejects a literal URL in auth prose and names the field', () => {
    const issue = validateAuthLaneOverride({
      laneClass: 'auth',
      variables,
      authLinkHosts: ['id.shellui.com'],
      subject: 'Sign in at https://evil.example',
      preheader: '',
      document: document('{{ magic_link_url }}'),
    });
    expect(issue?.errorCode).toBe('auth_literal_link');
    expect(issue?.fieldErrors.subject).toEqual(['literal_url']);
  });

  it('rejects an auth override that drops the required link variable', () => {
    const issue = validateAuthLaneOverride({
      laneClass: 'auth',
      variables,
      subject: 'Sign in',
      preheader: '',
      document: {
        preview: '',
        blocks: [{ type: 'text', text: 'Sign in with the button.' }],
      },
    });
    expect(issue?.errorCode).toBe('auth_link_missing');
    expect(issue?.fieldErrors.magic_link_url).toEqual(['required']);
  });

  it('rejects a button href that is not the link variable or an https address', () => {
    const issue = validateAuthLaneOverride({
      laneClass: 'auth',
      variables,
      subject: '{{ magic_link_url }}',
      preheader: '',
      document: document('http://evil.example/phish'),
    });
    expect(issue?.errorCode).toBe('auth_link_host_not_allowed');
  });

  it('does not apply auth rules to other lanes', () => {
    expect(
      validateAuthLaneOverride({
        laneClass: 'transactional',
        variables,
        subject: 'Hello',
        preheader: '',
        document: { preview: '', blocks: [{ type: 'text', text: 'No link' }] },
      }),
    ).toBeNull();
  });
});
