import { useTranslation } from 'react-i18next';
import { CircleAlert, SearchX } from 'lucide-react';
import { isRouteErrorResponse, useLocation, useNavigate, useRouteError } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

function ErrorPanel({ title, detail, retry }: { title: string; detail: string; retry?: boolean }) {
  const { t } = useTranslation();
  const Icon = retry ? CircleAlert : SearchX;
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <div className="flex min-h-full items-center justify-center bg-background px-6 py-12">
      <div
        role={retry ? 'alert' : undefined}
        className="w-full max-w-xl space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm"
      >
        <span className="flex size-10 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
          <Icon
            className="size-5"
            aria-hidden
          />
        </span>
        <h1 className="font-heading text-xl font-semibold tracking-tight">{title}</h1>
        <Text className="break-words font-mono text-sm text-muted-foreground">{detail}</Text>
        <div className="flex gap-2">
          {retry ? (
            <Button
              type="button"
              // A new location key re-renders the route without reloading the frame.
              onClick={() => navigate(location, { replace: true, state: { retry: Date.now() } })}
            >
              {t('routeErrorRetry')}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/')}
          >
            {t('routeErrorBack')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function RouteErrorPage() {
  const { t } = useTranslation();
  const error = useRouteError();
  let title = t('routeErrorTitle');
  let detail = t('routeErrorDetail');

  if (isRouteErrorResponse(error)) {
    title = `${error.status} ${error.statusText}`;
    detail = typeof error.data === 'string' ? error.data : detail;
  } else if (error instanceof Error) {
    detail = error.message || detail;
  }

  return (
    <ErrorPanel
      title={title}
      detail={detail}
      retry
    />
  );
}

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <ErrorPanel
      title={t('notFoundTitle')}
      detail={t('notFoundDetail')}
    />
  );
}
