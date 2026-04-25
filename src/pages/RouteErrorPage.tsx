import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

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
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-xl space-y-4 rounded-lg border border-border bg-card p-6">
        <h1 className="font-heading text-xl font-semibold tracking-tight">{title}</h1>
        <Text className="font-mono text-sm text-muted-foreground">{detail}</Text>
        <div className="flex gap-2">
          <Button type="button" onClick={() => window.location.reload()}>
            Reload
          </Button>
          <Button type="button" variant="outline" onClick={() => (window.location.hash = '#/')}>
            Back to dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
