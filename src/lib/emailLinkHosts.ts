/**
 * Extra auth-link hostnames, matching email-service `classify_extra_host`.
 * Exact hostnames only: no scheme, path, port, wildcard, or IP address.
 * `localhost` is a hostname here; the service refuses it when DEBUG is off.
 */

export const MAX_EXTRA_LINK_HOSTS = 32;

export const LINK_HOST_ERROR_CODES = [
  'invalid',
  'invalid_hostname',
  'wildcard_not_allowed',
  'ip_not_allowed',
  'port_not_allowed',
  'path_not_allowed',
  'scheme_not_allowed',
  'localhost_not_allowed',
  'too_many',
] as const;

export type LinkHostErrorCode = (typeof LINK_HOST_ERROR_CODES)[number];

const LABEL = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
const DNS_RE = new RegExp(`^(?:${LABEL}\\.)+${LABEL}$`);

export function classifyExtraHost(raw: string): { host: string } | { code: LinkHostErrorCode } {
  if (typeof raw !== 'string') return { code: 'invalid_hostname' };
  const text = raw.trim().toLowerCase();
  if (!text) return { code: 'invalid_hostname' };
  if (text.includes('://') || text.startsWith('//')) return { code: 'scheme_not_allowed' };
  if (/[ /?#\\]/.test(text)) return { code: 'path_not_allowed' };
  if (text.includes('*') || text.startsWith('.')) return { code: 'wildcard_not_allowed' };
  if (text.includes('@')) return { code: 'invalid_hostname' };
  const bare = text.startsWith('[') && text.endsWith(']') ? text.slice(1, -1) : text;
  if (isIpLiteral(bare)) return { code: 'ip_not_allowed' };
  if (bare.includes(':')) return { code: 'port_not_allowed' };
  const host = canonicalHost(bare);
  if (!host) return { code: 'invalid_hostname' };
  if (isIpLiteral(host) || disguisedIp(host)) return { code: 'ip_not_allowed' };
  return { host };
}

/** Sorted unique extra hosts, or the first rejection. */
export function parseExtraHosts(value: unknown): { hosts: string[] } | { code: LinkHostErrorCode } {
  if (typeof value === 'string' || !Array.isArray(value)) return { code: 'invalid' };
  if (value.length > MAX_EXTRA_LINK_HOSTS) return { code: 'too_many' };
  const hosts: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string') return { code: 'invalid_hostname' };
    const parsed = classifyExtraHost(item);
    if ('code' in parsed) return parsed;
    if (!seen.has(parsed.host)) {
      seen.add(parsed.host);
      hosts.push(parsed.host);
    }
  }
  hosts.sort();
  return { hosts };
}

function isDottedIpv4(value: string): boolean {
  const parts = value.split('.');
  if (parts.length !== 4) return false;
  return parts.every((part) => /^[0-9]+$/.test(part) && Number(part) <= 255);
}

function isIpv6(value: string): boolean {
  if (!value.includes(':')) return false;
  try {
    return new URL(`http://[${value}]/`).hostname.includes(':');
  } catch {
    return false;
  }
}

function isIpLiteral(value: string): boolean {
  return isDottedIpv4(value) || isIpv6(value);
}

function disguisedIp(host: string): boolean {
  for (const label of host.split('.')) {
    if (label.startsWith('0x')) return true;
    if (label.length > 1 && /^[0-9]+$/.test(label) && label.startsWith('0')) return true;
  }
  return false;
}

function canonicalHost(value: string): string | null {
  let raw = value.trim().toLowerCase();
  if (!raw) return null;
  if (raw.startsWith('[') && raw.endsWith(']')) raw = raw.slice(1, -1);
  if (isIpLiteral(raw)) return raw;
  if (raw.endsWith('.')) return null;
  let encoded: string;
  try {
    encoded = new URL(`https://${raw}`).hostname;
  } catch {
    return null;
  }
  if (!encoded || encoded.endsWith('.')) return null;
  if (encoded !== 'localhost' && !DNS_RE.test(encoded)) return null;
  return encoded;
}
