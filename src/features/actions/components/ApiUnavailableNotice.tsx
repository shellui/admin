import { Text } from '@/components/ui/text';
import { ApiUnavailableError } from '@/lib/adminIdentityFetch';

type Props = {
  error: unknown;
  fallbackKey?: string;
  t: (key: string) => string;
};

export function isApiUnavailableError(error: unknown): boolean {
  return (
    error instanceof ApiUnavailableError ||
    (error instanceof Error && error.message.includes('not available on this identity'))
  );
}

export function ApiUnavailableNotice({ error, t }: Props) {
  const message = error instanceof Error ? error.message : t('actionsApiUnavailableGeneric');
  return (
    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3">
      <Text className="font-mono text-sm text-amber-950 dark:text-amber-100">{message}</Text>
    </div>
  );
}
