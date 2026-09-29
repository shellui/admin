import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Text } from '@/components/ui/text';
import type { OAuthSocialAppRow } from '@/lib/adminOauthClientsApi';
import type { OAuthCatalogProvider } from '@/lib/oauthProviderCatalogTypes';
import { OAuthProviderIconView } from '@/components/oauth/OAuthProviderIcon';

type Props = {
  rows: OAuthSocialAppRow[];
  catalogBySlug: Map<string, OAuthCatalogProvider>;
  colorScheme?: 'light' | 'dark';
};

export function OAuthAppsTable({ rows, catalogBySlug, colorScheme = 'light' }: Props) {
  const { t } = useTranslation();
  const linked = rows.filter((r) => r.is_linked);

  if (linked.length === 0) {
    return (
      <Text className="font-mono text-sm text-muted-foreground">{t('oauthWizardAppsEmpty')}</Text>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('oauthClientsColProvider')}</TableHead>
          <TableHead>{t('oauthSetupColClientId')}</TableHead>
          <TableHead>{t('oauthSetupColStatus')}</TableHead>
          <TableHead className="text-right">{t('oauthWizardActions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {linked.map((row) => {
          const catalog = catalogBySlug.get(row.provider.toLowerCase());
          return (
            <TableRow key={row.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  {catalog ? (
                    <OAuthProviderIconView
                      provider={catalog}
                      size="sm"
                      colorScheme={colorScheme}
                    />
                  ) : null}
                  <span className="font-mono text-xs">{catalog?.name ?? row.provider}</span>
                </div>
              </TableCell>
              <TableCell className="max-w-[14rem] truncate font-mono text-xs">
                {row.client_id}
              </TableCell>
              <TableCell>
                <Badge variant={row.mapping_is_active ? 'default' : 'outline'}>
                  {row.mapping_is_active
                    ? t('oauthSetupStatusEnabled')
                    : t('oauthSetupStatusDisabled')}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
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
