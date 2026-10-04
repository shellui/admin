import { describe, expect, it } from 'vitest';
import { validateAuthLaneOverride } from '@/lib/emailAuthTemplate';
import type { EmailDocument, EmailNode, EmailVariable } from '@/lib/emailDocument';

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

function paragraph(text: string, href?: string): EmailNode {
  return {
    type: 'paragraph',
    content: [
      href
        ? { type: 'text', text, marks: [{ type: 'link', attrs: { href } }] }
        : { type: 'text', text },
    ],
  };
}

function doc(...content: EmailNode[]): EmailDocument {
  return { type: 'doc', content: [{ type: 'container', content }] };
}

function document(href: string, ...extra: EmailNode[]): EmailDocument {
  return doc(
    paragraph('Use {{ magic_link_url }}'),
    { type: 'button', attrs: { href }, content: [{ type: 'text', text: 'Sign in' }] },
    ...extra,
  );
}

const auth = { laneClass: 'auth', variables, preheader: '' };

describe('validateAuthLaneOverride', () => {
  it('accepts the magic link variable on an auth button', () => {
    expect(
      validateAuthLaneOverride({
        ...auth,
        subject: 'Sign in',
        document: document('{{ magic_link_url }}'),
      }),
    ).toBeNull();
  });

  it('accepts an https button href on the exposed allowlist', () => {
    expect(
      validateAuthLaneOverride({
        ...auth,
        authLinkHosts: ['id.shellui.com'],
        subject: 'Sign in',
        document: document('https://id.shellui.com/api/v1/magic-link/verify'),
      }),
    ).toBeNull();
  });

  it('rejects a button host that is not on auth_link_hosts', () => {
    const issue = validateAuthLaneOverride({
      ...auth,
      authLinkHosts: ['id.shellui.com'],
      subject: 'Sign in',
      document: document('https://evil.example/phish'),
    });
    expect(issue?.errorCode).toBe('auth_link_host_not_allowed');
  });

  it('rejects a literal URL in the subject and names the field', () => {
    const issue = validateAuthLaneOverride({
      ...auth,
      authLinkHosts: ['id.shellui.com'],
      subject: 'Sign in at https://evil.example',
      document: document('{{ magic_link_url }}'),
    });
    expect(issue?.errorCode).toBe('auth_literal_link');
    expect(issue?.fieldErrors.subject).toEqual(['literal_url']);
  });

  it('rejects an auth email that drops the required link variable', () => {
    const issue = validateAuthLaneOverride({
      ...auth,
      subject: 'Sign in',
      document: doc(paragraph('Sign in with the button.')),
    });
    expect(issue?.errorCode).toBe('auth_link_missing');
    expect(issue?.fieldErrors.magic_link_url).toEqual(['required']);
  });

  it('rejects a button href that is not the link variable or an https address', () => {
    const issue = validateAuthLaneOverride({
      ...auth,
      subject: 'Sign in',
      document: document('http://evil.example/phish'),
    });
    expect(issue?.errorCode).toBe('auth_link_host_not_allowed');
  });

  it('checks link marks, image links, and body text', () => {
    const input = { ...auth, authLinkHosts: ['id.shellui.com'], subject: 'Sign in' };
    expect(
      validateAuthLaneOverride({
        ...input,
        document: document(
          '{{ magic_link_url }}',
          paragraph('Help', 'https://id.shellui.com/help'),
        ),
      }),
    ).toBeNull();
    expect(
      validateAuthLaneOverride({
        ...input,
        document: document('{{ magic_link_url }}', paragraph('Help', 'https://evil.example')),
      })?.errorCode,
    ).toBe('auth_link_host_not_allowed');
    expect(
      validateAuthLaneOverride({
        ...input,
        document: document('{{ magic_link_url }}', {
          type: 'image',
          attrs: { src: '{{ system.assets_url }}/logo.png', href: 'https://evil.example' },
        }),
      })?.errorCode,
    ).toBe('auth_link_host_not_allowed');
    expect(
      validateAuthLaneOverride({
        ...input,
        document: document('{{ magic_link_url }}', paragraph('Go to https://evil.example')),
      })?.errorCode,
    ).toBe('auth_literal_link');
  });

  it('allows the message id link auth emails use for their footer', () => {
    expect(
      validateAuthLaneOverride({
        ...auth,
        subject: 'Sign in',
        document: document('{{ magic_link_url }}', paragraph('Why?', '{{ system.message_id }}')),
      }),
    ).toBeNull();
  });

  it('does not apply auth rules to other lanes', () => {
    expect(
      validateAuthLaneOverride({
        laneClass: 'transactional',
        variables,
        subject: 'Hello https://example.com',
        preheader: '',
        document: doc(paragraph('No link')),
      }),
    ).toBeNull();
  });
});
