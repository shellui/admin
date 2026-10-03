import { describe, expect, it } from 'vitest';
import type { ActionRule } from '@/features/actions/types';
import type { EmailRule } from '@/lib/emailTypes';
import { mergeServiceRules } from '@/lib/serviceRules';

function webhook(
  overrides: Partial<ActionRule> & Pick<ActionRule, 'id' | 'event' | 'created_at'>,
): ActionRule {
  return {
    name: 'Hook',
    enabled: true,
    config: { url: 'https://hooks.example/shellui' },
    updated_at: overrides.created_at,
    ...overrides,
  };
}

function email(
  overrides: Partial<EmailRule> & Pick<EmailRule, 'id' | 'eventType' | 'createdAt'>,
): EmailRule {
  return {
    service: 'hosting',
    enabled: true,
    recipientMode: 'hints',
    staticRecipients: [],
    language: '',
    templateId: 15,
    builtIn: false,
    updatedAt: overrides.createdAt,
    ...overrides,
  };
}

describe('mergeServiceRules', () => {
  it('orders webhook and email rules by event id, then created date', () => {
    const merged = mergeServiceRules({
      webhooks: [
        webhook({
          id: 2,
          event: 'storage.file.created',
          created_at: '2026-01-02T00:00:00Z',
          config: { url: 'https://hooks.example/files' },
        }),
        webhook({
          id: 1,
          event: 'hosting.deployment.failed',
          created_at: '2026-01-03T00:00:00Z',
          config: { url: 'https://hooks.example/deploy' },
        }),
      ],
      emails: [
        email({ id: 8, eventType: 'hosting.deployment.failed', createdAt: '2026-01-04T00:00:00Z' }),
        email({
          id: 7,
          eventType: 'hosting.deployment.failed',
          createdAt: '2026-01-01T00:00:00Z',
          recipientMode: 'static',
          staticRecipients: ['ops@example.com'],
          templateId: 15,
        }),
      ],
      templateName: () => 'Deploy failed',
      hintsLabel: "The event's recipient",
    });

    expect(merged.map((row) => `${row.kind}:${row.event}:${row.createdAt}`)).toEqual([
      'email:hosting.deployment.failed:2026-01-01T00:00:00Z',
      'webhook:hosting.deployment.failed:2026-01-03T00:00:00Z',
      'email:hosting.deployment.failed:2026-01-04T00:00:00Z',
      'webhook:storage.file.created:2026-01-02T00:00:00Z',
    ]);
    expect(merged[0]?.target).toBe('ops@example.com, Deploy failed');
    expect(merged[1]?.target).toBe('https://hooks.example/deploy');
    expect(merged[2]?.target).toBe("The event's recipient, Deploy failed");
    expect(merged[0]?.key).toBe('email:7');
    expect(merged[1]?.key).toBe('webhook:1');
  });
});
