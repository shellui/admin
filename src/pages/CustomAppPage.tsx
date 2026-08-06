import { useMemo } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RegisteredShellFrame } from '@/components/RegisteredShellFrame';
import { useShelluiAdministration } from '@/hooks/useShelluiAdministration';
import { useShelluiAuthBackendBaseUrl } from '@/hooks/useShelluiAuthBackendBaseUrl';
import { useShelluiIsStaff } from '@/hooks/useShelluiIsStaff';
import { resolveAdminAppUrl } from '@/lib/resolveAdminAppUrl';

/**
 * Host-configured admin navigation item: embeds the app URL in a ShellUI content iframe.
 * Items with `openIn: 'external'` are opened from the sidebar in a new tab instead.
 */
export function CustomAppPage() {
  const { t } = useTranslation();
  const { appPath } = useParams<{ appPath: string }>();
  const administration = useShelluiAdministration();
  const authBackendBaseUrl = useShelluiAuthBackendBaseUrl();
  const isStaff = useShelluiIsStaff();

  const item = useMemo(() => {
    if (!appPath || !administration?.navigation?.length) return null;
    const normalized = appPath.replace(/^\/+/, '');
    return (
      administration.navigation.find((entry) => entry.path.replace(/^\/+/, '') === normalized) ??
      null
    );
  }, [administration, appPath]);

  const iframeSrc = useMemo(
    () => resolveAdminAppUrl(item?.url, authBackendBaseUrl),
    [item, authBackendBaseUrl],
  );

  if (!appPath) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  if (!item) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-3 px-4 py-8 md:px-6">
        <h1 className="text-xl font-semibold tracking-tight">{t('customAppNotFoundTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('customAppNotFoundDescription')}</p>
      </div>
    );
  }

  if (item.requiresStaff && !isStaff) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  // External items open via target=_blank from the sidebar (apps that block iframes).
  if (item.openIn === 'external') {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  return (
    <div className="h-full w-full overflow-hidden">
      <RegisteredShellFrame
        key={iframeSrc}
        src={iframeSrc}
        title={item.label}
      />
    </div>
  );
}
