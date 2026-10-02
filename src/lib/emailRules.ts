import type {
  EmailRecipientMode,
  EmailRule,
  EmailRuleWrite,
  EmailStaticRecipient,
} from '@/lib/emailTypes';

export function recipientEmail(recipient: EmailStaticRecipient): string {
  if (typeof recipient === 'string') return recipient.trim();
  return recipient.email.trim();
}

export function staticRecipientLines(recipients: EmailStaticRecipient[]): string {
  return recipients.map(recipientEmail).filter(Boolean).join('\n');
}

export function parseStaticRecipientLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function rulesForService<T extends { service: string }>(rules: T[], service: string): T[] {
  return rules.filter((rule) => rule.service === service);
}

export function nextRuleWrite(
  rule: EmailRule,
  patch: Partial<{
    enabled: boolean;
    templateKey: string;
    language: string;
    recipientMode: EmailRecipientMode;
    staticRecipients: string[];
  }> = {},
): EmailRuleWrite {
  const staticRecipients =
    patch.staticRecipients ?? rule.staticRecipients.map(recipientEmail).filter(Boolean);
  return {
    event_type: rule.eventType,
    enabled: patch.enabled ?? rule.enabled,
    template_key: patch.templateKey ?? rule.templateKey,
    language: patch.language ?? rule.language,
    recipient_mode: patch.recipientMode ?? rule.recipientMode,
    static_recipients: staticRecipients,
  };
}
