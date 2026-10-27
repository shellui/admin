import { useState } from 'react';
import { cn } from '@/lib/utils';

/** Up to two initials from a name, falling back to the email local part. */
export function initialsFor(name: string, email?: string): string {
  const source = name.trim() || (email ?? '').split('@')[0] || '';
  const parts = source
    .replace(/[._-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : (parts[0]?.[1] ?? '');
  return `${first}${last}`.toUpperCase() || '?';
}

export function InitialsAvatar({
  name,
  email,
  imageUrl,
  className,
}: {
  name: string;
  email?: string;
  imageUrl?: string | null;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const base = cn(
    'inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-[11px] font-semibold text-muted-foreground',
    className,
  );
  if (imageUrl && !broken) {
    return (
      <img
        src={imageUrl}
        alt=""
        className={cn(base, 'object-cover')}
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <span
      className={base}
      aria-hidden
    >
      {initialsFor(name, email)}
    </span>
  );
}
