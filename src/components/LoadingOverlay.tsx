import { useTranslation } from 'react-i18next';
import { LOADING_OVERLAY_DURATION_MS } from '@/constants/loading';

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Thin gold loading bar at the top of the content area, like Shellui core ContentView. */
export function LoadingOverlay() {
  const { t } = useTranslation();
  const reduced = prefersReducedMotion();
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-20"
      role="progressbar"
      aria-label={t('pageLoading')}
    >
      <div
        className="h-[3px] w-full overflow-hidden"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--primary) 15%, transparent)',
        }}
      >
        <div
          className="h-full"
          style={{
            width: reduced ? '40%' : 0,
            backgroundColor: 'var(--primary)',
            animation: reduced
              ? 'none'
              : `loading-bar-slide ${LOADING_OVERLAY_DURATION_MS}ms linear infinite`,
          }}
        />
      </div>
    </div>
  );
}
