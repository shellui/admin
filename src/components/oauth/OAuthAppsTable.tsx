import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { OAuthSocialAppRow } from '@/lib/adminOauthClientsApi';
import type { OAuthCatalogProvider } from '@/lib/oauthProviderCatalogTypes';
import { OAuthProviderIcon } from '@/components/oauth/OAuthProviderIcon';
import {
  buildOAuthCatalogIndex,
  catalogProviderForSocialApp,
  resolveSocialAppDocsSlug,
} from '@/lib/oauthProviderResolve';

type Props = {
  rows: OAuthSocialAppRow[];
  catalogProviders: OAuthCatalogProvider[];
  colorScheme?: 'light' | 'dark';
};

export function OAuthAppsTable({ rows, catalogProviders, colorScheme = 'light' }: Props) {
  const { t } = useTranslation();
  const linked = rows.filter((r) => r.is_linked);
  const catalogIndex = useMemo(() => buildOAuthCatalogIndex(catalogProviders), [catalogProviders]);

  if (linked.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">{t('oauthWizardAppsEmpty')}</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>{t('oauthClientsColProvider')}</TableHead>
          <TableHead className="hidden sm:table-cell">{t('oauthSetupColClientId')}</TableHead>
          <TableHead>{t('oauthSetupColStatus')}</TableHead>
          <TableHead className="text-right">{t('oauthWizardActions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {linked.map((row) => {
          const catalog = catalogProviderForSocialApp(row, catalogIndex);
          const docsSlug = resolveSocialAppDocsSlug(row);
          return (
            <TableRow key={row.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  {docsSlug ? (
                    <OAuthProviderIcon
                      docsSlug={docsSlug}
                      protocol={catalog?.protocol}
                      title={catalog?.name ?? row.name}
                      size="sm"
                      colorScheme={colorScheme}
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="flex size-7 items-center justify-center rounded-md border border-border bg-muted"
                    >
                      <KeyRound className="size-3.5 text-muted-foreground" />
                    </span>
                  )}
                  <span className="font-medium">{catalog?.name ?? row.provider}</span>
                </div>
              </TableCell>
              <TableCell className="hidden max-w-56 truncate font-mono text-xs text-muted-foreground sm:table-cell">
                {row.client_id}
              </TableCell>
              <TableCell>
                <StatusBadge
                  tone={row.mapping_is_active ? 'success' : 'muted'}
                  dot
                >
                  {row.mapping_is_active
                    ? t('oauthSetupStatusEnabled')
                    : t('oauthSetupStatusDisabled')}
                </StatusBadge>
              </TableCell>
              <TableCell className="text-right">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  asChild
                >
                  <Link to={`/oauth/apps/${row.id}/edit`}>{t('oauthWizardEditApp')}</Link>
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
