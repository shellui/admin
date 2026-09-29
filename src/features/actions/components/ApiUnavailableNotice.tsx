import { Text } from '@/components/ui/text';
import { ApiUnavailableError } from '@/lib/serviceAuthFetch';

type Props = {
  error: unknown;
  fallbackKey?: string;
  t: (key: string) => string;
};

const UNAVAILABLE_SNIPPETS = [
  'not available on this identity version',
  'not available on this hosting version',
  'not available on this storage version',
  'Webhooks API is not available',
] as const;

export function isApiUnavailableError(error: unknown): boolean {
  if (error instanceof ApiUnavailableError) return true;
  if (!(error instanceof Error)) return false;
  return UNAVAILABLE_SNIPPETS.some((snippet) => error.message.includes(snippet));
}

export function ApiUnavailableNotice({ error, t }: Props) {
  const message = error instanceof Error ? error.message : t('actionsApiUnavailableGeneric');
  return (
    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3">
      <Text className="font-mono text-sm text-amber-950 dark:text-amber-100">{message}</Text>
    </div>
  );
}
