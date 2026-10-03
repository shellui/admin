import type { EmailStaticRecipient } from '@/lib/emailTypes';

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
