import { useEffect, type RefObject } from 'react';

/** Closes an inline popover on a pointer down outside `root` or on Escape, which returns focus to `trigger`. */
export function usePopoverDismiss(
  open: boolean,
  close: () => void,
  root: RefObject<HTMLElement>,
  trigger: RefObject<HTMLElement>,
) {
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) close();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      close();
      trigger.current?.focus();
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, close, root, trigger]);
}
