import { describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import type { McpPersonalAgent } from '@/lib/personalAgentsApi';
import type { CompanyMcpAgent } from '@/lib/companyAgentsTypes';
import {
  AGENT_CONNECT_STEPS,
  MCP_PERSONAL_AGENT_MAX_LIFETIME_DAYS,
  agentIncludesSaasScope,
  agentPromptContainsCredentialMaterial,
  buildAgentPrompt,
  buildCompanyMcpUrl,
  connectionKindLines,
  defaultPersonalAgentExpiresAt,
  formatDefaultAgentName,
  getDefaultPersonalAgentServices,
  isAbsoluteHttpUrl,
  isGlobalIdentitySession,
  mergeCompanyAndPersonalAgents,
  personalAgentCreateErrorMessage,
  resolveAgentConnectPromptLocale,
} from '@/lib/mcpAgentsConnect';

const MCP_URL = 'https://ai.example.com/c/1/mcp';

const CONNECT_KEYS = [
  'agentsConnectIntro',
  'agentsConnectUrlLabel',
  'agentsCopyUrl',
  'agentsConnectPromptLabel',
  'agentsCopyPrompt',
  'agentsConnectStepsLead',
  'agentsConnectStepPaste',
  'agentsConnectStepOpen',
  'agentsConnectStepAllow',
  'agentsStaticSecretSummary',
  'agentsStaticSecretHelper',
  'agentsStaticSecretOnce',
  'agentsStaticSecretCreateTitle',
  'agentsConnectNameLabel',
  'agentsConnectNamePlaceholder',
  'agentsConnectNameHint',
  'agentsConnectAccessGlobal',
  'agentsConnectAccessRegional',
  'agentsConnectCreateButton',
  'agentsConnectCreating',
  'agentsConnectCreateError',
  'agentsConnectCancel',
  'agentsConnectExpiry',
  'agentsConnectExpiryTooLong',
  'agentsConnectCreatedTitle',
  'agentsConnectCreatedHint',
  'agentsCopySecret',
  'agentsHideSecret',
  'agentsConnectMissingUrl',
  'agentsKindOauth',
  'agentsKindPersonal',
  'agentsKindServices',
  'agentsScopeRegional',
  'agentsScopeRegionalSaas',
] as const;

const SITUATION_MARKERS = [
  'employment',
  'benefits',
  'personal situation',
  'emploi',
  'salaire',
  'avantages',
  'situation personnelle',
];

describe('mcpAgentsConnect', () => {
  it('builds company MCP URL from ai-service origin', () => {
    expect(buildCompanyMcpUrl('https://ai.example.com', 7)).toBe('https://ai.example.com/c/7/mcp');
  });

  it('includes saas only for global identity sessions', () => {
    expect(getDefaultPersonalAgentServices(false)).not.toContain('saas');
    expect(getDefaultPersonalAgentServices(true)).toContain('saas');
    expect(
      isGlobalIdentitySession({ mcp_enabled: true, mcp_url: null, global_identity: true }),
    ).toBe(true);
  });

  it('formats default agent name', () => {
    expect(formatDefaultAgentName('en', new Date('2026-11-05T12:00:00Z'))).toMatch(/^Agent · /);
  });
});

describe('isAbsoluteHttpUrl', () => {
  it('accepts http and https and rejects relative paths', () => {
    expect(isAbsoluteHttpUrl('https://ai.test/c/1/mcp')).toBe(true);
    expect(isAbsoluteHttpUrl('http://localhost:8006/c/1/mcp')).toBe(true);
    expect(isAbsoluteHttpUrl('/c/1/mcp')).toBe(false);
    expect(isAbsoluteHttpUrl('')).toBe(false);
  });
});

describe('resolveAgentConnectPromptLocale', () => {
  it('selects French only for fr language tags', () => {
    expect(resolveAgentConnectPromptLocale('fr')).toBe('fr');
    expect(resolveAgentConnectPromptLocale('fr-CA')).toBe('fr');
    expect(resolveAgentConnectPromptLocale('en-US')).toBe('en');
    expect(resolveAgentConnectPromptLocale(null)).toBe('en');
  });
});

describe('buildAgentPrompt', () => {
  const english = [
    'Connect to this Shellui company over MCP.',
    '',
    `MCP URL: ${MCP_URL}`,
    '',
    'Add this URL as a remote MCP server and sign in with OAuth.',
    'If this client is headless or a CLI, use device login.',
    'Show the link and the code, then wait until I approve them.',
  ].join('\n');
  const french = [
    'Connectez cette entreprise Shellui en MCP.',
    '',
    `URL MCP : ${MCP_URL}`,
    '',
    'Ajoutez cette URL comme serveur MCP distant et connectez-vous avec OAuth.',
    'Si le client est sans interface ou en ligne de commande, utilisez device login.',
    'Montrez le lien et le code, puis attendez que je les approuve.',
  ].join('\n');

  it('uses the English OAuth prompt and the company MCP URL', () => {
    expect(buildAgentPrompt(MCP_URL)).toBe(english);
    expect(buildAgentPrompt(MCP_URL, 'en')).toBe(english);
    expect(buildAgentPrompt(`  ${MCP_URL}  `, 'en')).toBe(english);
  });

  it('uses the French OAuth prompt for fr', () => {
    expect(buildAgentPrompt(MCP_URL, 'fr')).toBe(french);
  });

  it('does not interpolate a token passed in place of the locale', () => {
    const leaked = 'shh-static-secret-value';
    const prompt = buildAgentPrompt(MCP_URL, leaked as 'en');
    expect(prompt).toBe(english);
    expect(prompt).not.toContain(leaked);
    expect(prompt).not.toMatch(/[A-Z0-9]{4}-[A-Z0-9]{4}/);
    expect(agentPromptContainsCredentialMaterial(prompt.replace(MCP_URL, ''))).toBe(false);
    expect(agentPromptContainsCredentialMaterial(french.replace(MCP_URL, ''))).toBe(false);
  });

  it('rejects a URL that is not absolute http(s)', () => {
    expect(() => buildAgentPrompt('/c/1/mcp')).toThrow(/absolute http/);
  });

  it('matches the translated steps', () => {
    const en = i18n.getResourceBundle('en', 'translation') as Record<string, string>;
    const fr = i18n.getResourceBundle('fr', 'translation') as Record<string, string>;
    expect([
      en.agentsConnectStepPaste,
      en.agentsConnectStepOpen,
      en.agentsConnectStepAllow,
    ]).toEqual([...AGENT_CONNECT_STEPS.en]);
    expect([
      fr.agentsConnectStepPaste,
      fr.agentsConnectStepOpen,
      fr.agentsConnectStepAllow,
    ]).toEqual([...AGENT_CONNECT_STEPS.fr]);
    expect(en.agentsConnectStepsLead).toBe('What you do:');
    expect(fr.agentsConnectStepsLead).toBe('Ce que vous faites :');
  });
});

describe('agent connect copy', () => {
  it('keeps English and French keys aligned and free of personal-situation wording', () => {
    const en = i18n.getResourceBundle('en', 'translation') as Record<string, string>;
    const fr = i18n.getResourceBundle('fr', 'translation') as Record<string, string>;
    for (const key of CONNECT_KEYS) {
      expect(typeof en[key], key).toBe('string');
      expect(typeof fr[key], key).toBe('string');
      expect(en[key].trim().length).toBeGreaterThan(0);
      expect(fr[key].trim().length).toBeGreaterThan(0);
      const haystack = `${en[key]}\n${fr[key]}`.toLowerCase();
      for (const marker of SITUATION_MARKERS) {
        expect(haystack, `${key} ${marker}`).not.toContain(marker);
      }
    }
    const prompts = `${buildAgentPrompt(MCP_URL, 'en')}\n${buildAgentPrompt(MCP_URL, 'fr')}`
      .replaceAll(MCP_URL, '')
      .toLowerCase();
    for (const marker of SITUATION_MARKERS) {
      expect(prompts).not.toContain(marker);
    }
    expect(prompts).not.toContain('token');
    expect(prompts).not.toContain('secret');
  });
});

describe('defaultPersonalAgentExpiresAt', () => {
  it('stays inside Identity default maximum of 90 days', () => {
    const fromMs = Date.parse('2026-11-09T17:05:00.000Z');
    const expiresMs = Date.parse(defaultPersonalAgentExpiresAt(fromMs));
    const maxMs = fromMs + MCP_PERSONAL_AGENT_MAX_LIFETIME_DAYS * 86_400_000;
    expect(expiresMs).toBeLessThan(maxMs);
    expect(maxMs - expiresMs).toBe(60_000);
    expect(expiresMs - fromMs).toBeLessThan(365 * 86_400_000);
  });
});

describe('personalAgentCreateErrorMessage', () => {
  it('replaces Identity lifetime rejections with the lifetime message', () => {
    expect(
      personalAgentCreateErrorMessage(
        new Error('expires_at exceeds the maximum allowed lifetime.'),
        {
          expiryTooLong: 'too long',
          fallback: 'generic',
        },
      ),
    ).toBe('too long');
  });

  it('keeps other errors and falls back when the error has no message', () => {
    expect(
      personalAgentCreateErrorMessage(new Error('MCP is not enabled.'), {
        expiryTooLong: 'too long',
        fallback: 'generic',
      }),
    ).toBe('MCP is not enabled.');
    expect(
      personalAgentCreateErrorMessage('nope', { expiryTooLong: 'too long', fallback: 'generic' }),
    ).toBe('generic');
  });
});

function companyAgent(overrides: Partial<CompanyMcpAgent> = {}): CompanyMcpAgent {
  return {
    id: 'company-1',
    name: 'Company agent',
    access_mode: 'ask',
    read_level: 'safe',
    allow_destructive_without_asking: false,
    services_allowed: ['identity'],
    project_scope: '',
    expires_at: '2026-12-01T00:00:00.000Z',
    paused_at: null,
    revoked_at: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function personalAgent(overrides: Partial<McpPersonalAgent> = {}): McpPersonalAgent {
  return {
    id: 'oauth-1',
    kind: 'oauth',
    name: 'Cursor laptop',
    access_mode: 'ask',
    read_level: 'safe',
    allow_destructive_without_asking: false,
    services_allowed: ['identity', 'storage'],
    expires_at: '2026-12-01T00:00:00.000Z',
    paused_at: null,
    revoked_at: null,
    is_active: true,
    created_at: '2026-06-01T00:00:00.000Z',
    oauth_client_id: 'client-1',
    personal_token_id: null,
    ...overrides,
  };
}

describe('mergeCompanyAndPersonalAgents', () => {
  it('labels a company row from the personal list and appends OAuth rows the company list omitted', () => {
    const merged = mergeCompanyAndPersonalAgents(
      [
        companyAgent({
          id: 'static-1',
          name: 'Static from company',
          created_at: '2026-05-01T00:00:00.000Z',
        }),
      ],
      [
        personalAgent({
          id: 'static-1',
          kind: 'personal',
          name: 'Static from company',
          services_allowed: ['identity', 'email'],
          oauth_client_id: null,
          personal_token_id: 'pt-1',
          created_at: '2026-05-01T00:00:00.000Z',
        }),
        personalAgent(),
      ],
    );
    expect(merged.personalIds.has('oauth-1')).toBe(true);
    expect(merged.personalIds.has('static-1')).toBe(true);
    expect(merged.agents.map((agent) => agent.id)).toEqual(['oauth-1', 'static-1']);
    expect(merged.agents[1]?.kind).toBe('personal');
    expect(merged.agents[1]?.services_allowed).toEqual(['identity', 'email']);
    expect(merged.agents[0]?.kind).toBe('oauth');
  });

  it('keeps a company kind when the personal list does not include that agent', () => {
    const merged = mergeCompanyAndPersonalAgents(
      [companyAgent({ kind: 'oauth', services_allowed: ['hosting'] })],
      [],
    );
    expect(merged.agents[0]?.kind).toBe('oauth');
    expect(merged.personalIds.size).toBe(0);
  });
});

describe('connectionKindLines', () => {
  const labels = {
    oauth: 'Signed in with OAuth',
    personal: 'Static secret',
    services: (services: string) => `Services: ${services}`,
    scopeRegional: 'All regional services',
    scopeRegionalSaas: 'All regional services + saas',
  };

  it('labels OAuth with services and a static secret with its scope', () => {
    expect(
      connectionKindLines({ kind: 'oauth', services_allowed: ['identity', 'storage'] }, labels),
    ).toEqual(['Signed in with OAuth', 'Services: identity, storage']);
    expect(
      connectionKindLines({ kind: 'personal', services_allowed: ['identity'] }, labels),
    ).toEqual(['Static secret', 'All regional services']);
    expect(agentIncludesSaasScope({ services_allowed: ['identity', 'saas'] })).toBe(true);
    expect(connectionKindLines({ kind: 'personal', services_allowed: ['saas'] }, labels)).toEqual([
      'Static secret',
      'All regional services + saas',
    ]);
    expect(connectionKindLines({ kind: null, services_allowed: [] }, labels)).toEqual([]);
  });
});
