import { LOADING_OVERLAY_DURATION_MS } from '@/constants/loading';

/** Same visual as Shellui core ContentView loading bar. */
export function LoadingOverlay() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20">
      <div
        className="h-1 w-full overflow-hidden"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--muted) 30%, transparent)',
        }}
      >
        <div
          className="h-full"
          style={{
            width: 0,
            backgroundColor: 'color-mix(in srgb, var(--muted-foreground) 50%, transparent)',
            animation: `loading-bar-slide ${LOADING_OVERLAY_DURATION_MS}ms linear infinite`,
          }}
        />
      </div>
    </div>
  );
}
