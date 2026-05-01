import { useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { getAuthBackendBaseUrl } from '@/lib/backendUrl';
import { useShelluiDeveloperMode } from '@/hooks/useShelluiDeveloperMode';
import { RegisteredShellFrame } from '@/components/RegisteredShellFrame';

interface AuthDocsPageProps {
  kind: 'swagger' | 'redoc';
}

export function AuthDocsPage({ kind }: AuthDocsPageProps) {
  const isDeveloperMode = useShelluiDeveloperMode();

  const title = kind === 'swagger' ? 'Swagger' : 'ReDoc';
  const url = useMemo(() => {
    const base = getAuthBackendBaseUrl();
    return kind === 'swagger' ? `${base}/api/docs/` : `${base}/api/docs/redoc/`;
  }, [kind]);

  if (!isDeveloperMode) {
    return (
      <Navigate
        to="/oauth"
        replace
      />
    );
  }

  return (
    <div className="h-full w-full overflow-hidden">
      <RegisteredShellFrame
        src={url}
        title={title}
      />
    </div>
  );
}
