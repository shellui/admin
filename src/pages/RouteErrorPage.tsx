import { isRouteErrorResponse, useLocation, useNavigate, useRouteError } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

function ErrorPanel({ title, detail, retry }: { title: string; detail: string; retry?: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <div className="flex min-h-full items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-xl space-y-4 rounded-lg border border-border bg-card p-6">
        <h1 className="font-heading text-xl font-semibold tracking-tight">{title}</h1>
        <Text className="font-mono text-sm text-muted-foreground">{detail}</Text>
        <div className="flex gap-2">
          {retry ? (
            <Button
              type="button"
              // A new location key re-renders the route without reloading the frame.
              onClick={() => navigate(location, { replace: true, state: { retry: Date.now() } })}
            >
              Retry
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/')}
          >
            Back to dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}

export function RouteErrorPage() {
  const error = useRouteError();
  let title = 'Something went wrong';
  let detail = 'An unexpected error occurred while loading this page.';

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
  return (
    <ErrorPanel
      title="Not found"
      detail="This page does not exist."
    />
  );
}
