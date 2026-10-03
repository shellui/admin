import type { ActionRule } from '@/features/actions/types';
import type { EmailRule } from '@/lib/emailTypes';

export type MergedServiceRule = {
  key: string;
  kind: 'webhook' | 'email';
  id: string;
  event: string;
  createdAt: string;
  enabled: boolean;
  builtIn: boolean;
  /** Webhook URL, or recipients plus the template name. */
  target: string;
  name: string;
};

function compareRules(a: MergedServiceRule, b: MergedServiceRule): number {
  const byEvent = a.event.localeCompare(b.event);
  if (byEvent !== 0) return byEvent;
  return a.createdAt.localeCompare(b.createdAt);
}

export function emailRuleTarget(rule: EmailRule, templateName: string, hintsLabel: string): string {
  const recipients =
    rule.recipientMode === 'static' ? rule.staticRecipients.join(', ') : hintsLabel;
  return templateName ? `${recipients}, ${templateName}` : recipients;
}

/** Webhook and email rules for one service, ordered by event id then created date. */
export function mergeServiceRules(input: {
  webhooks: ActionRule[];
  emails: EmailRule[];
  templateName: (templateId: number) => string;
  hintsLabel: string;
}): MergedServiceRule[] {
  const webhooks: MergedServiceRule[] = input.webhooks.map((rule) => ({
    key: `webhook:${rule.id}`,
    kind: 'webhook',
    id: String(rule.id),
    event: rule.event,
    createdAt: rule.created_at,
    enabled: rule.enabled,
    builtIn: false,
    target: rule.config.url,
    name: rule.name,
  }));
  const emails: MergedServiceRule[] = input.emails.map((rule) => ({
    key: `email:${rule.id}`,
    kind: 'email',
    id: String(rule.id),
    event: rule.eventType,
    createdAt: rule.createdAt,
    enabled: rule.enabled,
    builtIn: rule.builtIn,
    target: emailRuleTarget(rule, input.templateName(rule.templateId), input.hintsLabel),
    name: input.templateName(rule.templateId) || rule.eventType,
  }));
  return [...webhooks, ...emails].sort(compareRules);
}
