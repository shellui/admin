import { EmailApiError } from '@/lib/emailApiErrors';
import type { EmailCatalogEvent } from '@/lib/emailTypes';

/** What a list's confirmation email may use, in the shape the editor reads from catalog events. */
export const NEWSLETTER_CONFIRMATION_EVENT: EmailCatalogEvent = {
  service: '',
  eventType: '',
  templateKey: 'newsletter_confirmation',
  label: 'Newsletter confirmation',
  laneClass: 'transactional',
  defaultLane: 'transactional',
  defaultEnabled: true,
  category: 'transactional',
  defaultTtlSeconds: null,
  variables: [
    {
      token: 'company_name',
      type: 'string',
      required: false,
      description: '',
      example: 'Acme',
      isUrl: false,
    },
    {
      token: 'list_name',
      type: 'string',
      required: false,
      description: '',
      example: 'Product news',
      isUrl: false,
    },
    {
      token: 'confirm_url',
      type: 'url',
      required: true,
      description: '',
      example: 'https://email.shellui.com/n/confirm/example',
      isUrl: true,
    },
    {
      token: 'first_name',
      type: 'string',
      required: false,
      description: '',
      example: 'Ada',
      isUrl: false,
    },
    {
      token: 'recipient_email',
      type: 'string',
      required: false,
      description: '',
      example: 'ada@example.com',
      isUrl: false,
    },
  ],
  linkToken: 'confirm_url',
  defaultTemplate: 'barebone.activation',
  suggested: {
    en: {
      subject: 'Confirm your subscription to {{ list_name }}',
      preheader: 'One click and you are on the list.',
    },
    fr: {
      subject: 'Confirmez votre inscription à {{ list_name }}',
      preheader: 'Un clic et vous êtes inscrit.',
    },
  },
};

export type NewsletterSubscriberStatus = 'pending' | 'confirmed' | 'unsubscribed';
export type NewsletterSubscriberSource = 'form' | 'admin' | 'import';
/** `confirm` sends the confirmation email. `consented` adds the address as confirmed. */
export type NewsletterAddMode = 'confirm' | 'consented';

export const NEWSLETTER_STATUSES: NewsletterSubscriberStatus[] = [
  'confirmed',
  'pending',
  'unsubscribed',
];

export type NewsletterCounts = Record<NewsletterSubscriberStatus, number>;

export type NewsletterSender = {
  fromEmail: string;
  /** Why confirmation emails cannot be sent, e.g. `provider_not_configured`. */
  errorCode: string;
};

export type Newsletter = {
  id: number;
  name: string;
  description: string;
  publicKey: string;
  defaultLanguage: string;
  /** Websites allowed to post the form. Empty means any. */
  allowedOrigins: string[];
  confirmedRedirectUrl: string;
  turnstileSiteKey: string;
  turnstileConfigured: boolean;
  confirmationTemplateId: number;
  subscribeUrl: string;
  counts: NewsletterCounts;
  createdAt: string;
  updatedAt: string;
  /** Only on detail responses. */
  sender: NewsletterSender | null;
};

export type NewsletterWrite = {
  name?: string;
  description?: string;
  default_language?: string;
  allowed_origins?: string[];
  confirmed_redirect_url?: string;
  turnstile_site_key?: string;
  /** Write only. Empty clears it. */
  turnstile_secret?: string;
};

export type NewsletterSubscriber = {
  id: number;
  /** Masked once the address has been cleared after unsubscribing. */
  email: string;
  firstName: string;
  language: string;
  status: NewsletterSubscriberStatus;
  source: NewsletterSubscriberSource;
  createdAt: string;
  confirmedAt: string | null;
  unsubscribedAt: string | null;
};

export type NewsletterSubscriberPage = {
  count: number;
  page: number;
  pageSize: number;
  results: NewsletterSubscriber[];
};

export type NewsletterSubscriberAdd = {
  email: string;
  first_name?: string;
  language?: string;
  mode?: NewsletterAddMode;
};

export type NewsletterAddOutcome = 'sent' | 'existing' | 'throttled' | 'suppressed' | 'added';

export type NewsletterImportResult = {
  added: number;
  existing: number;
  invalid: number;
  skippedUnsubscribed: number;
  skippedSuppressed: number;
};

export function emailNewsletterPath(id: number): string {
  return `/email/newsletters/${id}`;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function nullableStr(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function parseCounts(value: unknown): NewsletterCounts {
  const row = record(value) ?? {};
  return {
    pending: num(row.pending),
    confirmed: num(row.confirmed),
    unsubscribed: num(row.unsubscribed),
  };
}

export function parseNewsletter(body: unknown): Newsletter {
  const row = record(body);
  if (!row || typeof row.id !== 'number') throw new EmailApiError('request_failed', 200);
  const sender = record(row.sender);
  return {
    id: row.id,
    name: str(row.name),
    description: str(row.description),
    publicKey: str(row.public_key),
    defaultLanguage: str(row.default_language) || 'en',
    allowedOrigins: strings(row.allowed_origins),
    confirmedRedirectUrl: str(row.confirmed_redirect_url),
    turnstileSiteKey: str(row.turnstile_site_key),
    turnstileConfigured: row.turnstile_configured === true,
    confirmationTemplateId: num(row.confirmation_template_id),
    subscribeUrl: str(row.subscribe_url),
    counts: parseCounts(row.counts),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
    sender: sender
      ? { fromEmail: str(sender.from_email), errorCode: str(sender.error_code) }
      : null,
  };
}

export function parseNewsletters(body: unknown): Newsletter[] {
  const root = record(body);
  if (!root || !Array.isArray(root.newsletters)) throw new EmailApiError('request_failed', 200);
  return root.newsletters.map(parseNewsletter);
}

const STATUSES = new Set<string>(NEWSLETTER_STATUSES);
const SOURCES = new Set<string>(['form', 'admin', 'import']);

export function parseSubscriber(body: unknown): NewsletterSubscriber {
  const row = record(body);
  if (!row || typeof row.id !== 'number') throw new EmailApiError('request_failed', 200);
  return {
    id: row.id,
    email: str(row.email),
    firstName: str(row.first_name),
    language: str(row.language),
    status: STATUSES.has(str(row.status)) ? (row.status as NewsletterSubscriberStatus) : 'pending',
    source: SOURCES.has(str(row.source)) ? (row.source as NewsletterSubscriberSource) : 'form',
    createdAt: str(row.created_at),
    confirmedAt: nullableStr(row.confirmed_at),
    unsubscribedAt: nullableStr(row.unsubscribed_at),
  };
}

export function parseSubscriberPage(body: unknown): NewsletterSubscriberPage {
  const root = record(body);
  if (!root || !Array.isArray(root.results)) throw new EmailApiError('request_failed', 200);
  return {
    count: num(root.count),
    page: num(root.page) || 1,
    pageSize: num(root.page_size) || 50,
    results: root.results.map(parseSubscriber),
  };
}

const OUTCOMES = new Set<string>(['sent', 'existing', 'throttled', 'suppressed', 'added']);

export function parseSubscriberAdded(body: unknown): {
  outcome: NewsletterAddOutcome;
  subscriber: NewsletterSubscriber;
} {
  const root = record(body);
  if (!root) throw new EmailApiError('request_failed', 200);
  return {
    outcome: OUTCOMES.has(str(root.outcome)) ? (root.outcome as NewsletterAddOutcome) : 'existing',
    subscriber: parseSubscriber(root.subscriber),
  };
}

export function parseImportResult(body: unknown): NewsletterImportResult {
  const row = record(body);
  if (!row) throw new EmailApiError('request_failed', 200);
  return {
    added: num(row.added),
    existing: num(row.existing),
    invalid: num(row.invalid),
    skippedUnsubscribed: num(row.skipped_unsubscribed),
    skippedSuppressed: num(row.skipped_suppressed),
  };
}

const ORIGIN_RE = /^https?:\/\/[a-z0-9.-]+(:\d{1,5})?$/;

/** Origins from text, one per line or comma separated. URLs keep only their origin. */
export function parseOrigins(text: string): { origins: string[]; invalid: string[] } {
  const origins: string[] = [];
  const invalid: string[] = [];
  for (const part of text.split(/[\s,]+/)) {
    const raw = part.trim();
    if (!raw) continue;
    let origin = raw.toLowerCase().replace(/\/+$/, '');
    try {
      origin = new URL(raw).origin.toLowerCase();
    } catch {
      // Kept as typed, then checked below.
    }
    if (!ORIGIN_RE.test(origin)) {
      invalid.push(raw);
      continue;
    }
    if (!origins.includes(origin)) origins.push(origin);
  }
  return { origins, invalid };
}

/** A ready-to-paste sign-up form for the list. */
export function newsletterFormSnippet(
  newsletter: Pick<Newsletter, 'subscribeUrl' | 'turnstileSiteKey'>,
): string {
  const turnstile = newsletter.turnstileSiteKey
    ? `\n  <div class="cf-turnstile" data-sitekey="${newsletter.turnstileSiteKey}" data-response-field-name="turnstile_token"></div>`
    : '';
  const turnstileScript = newsletter.turnstileSiteKey
    ? '\n<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>'
    : '';
  return `<form id="newsletter">
  <input type="email" name="email" required autocomplete="email" placeholder="you@example.com" />
  <input type="text" name="website" tabindex="-1" autocomplete="off" hidden />${turnstile}
  <button type="submit">Subscribe</button>
  <p role="status"></p>
</form>${turnstileScript}
<script>
  const form = document.getElementById("newsletter");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const response = await fetch("${newsletter.subscribeUrl}", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, language: document.documentElement.lang }),
    });
    form.querySelector("[role=status]").textContent =
      response.status === 202 ? "Check your inbox to confirm." : "Something went wrong. Try again later.";
  });
</script>`;
}
