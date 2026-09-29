/**
 * Prevents body scroll (iOS Safari fix for position:fixed overlays).
 * Sets body to position:fixed so iOS treats fixed children correctly.
 * Returns an unlock function to call on cleanup.
 */
export function lockBodyScroll(): () => void {
  const scrollY = window.scrollY;

  // iOS Safari ignores overflow:hidden on body. We prevent touchmove at the
  // document level and only allow it on elements that are themselves scrollable.
  const prevent = (e: TouchEvent) => {
    let el = e.target as HTMLElement | null;
    while (el && el !== document.body) {
      const ov = window.getComputedStyle(el).overflowY;
      if ((ov === 'auto' || ov === 'scroll') && el.scrollHeight > el.clientHeight) return;
      el = el.parentElement;
    }
    e.preventDefault();
  };

  document.addEventListener('touchmove', prevent as EventListener, { passive: false });

  return () => {
    document.removeEventListener('touchmove', prevent as EventListener);
    window.scrollTo(0, scrollY);
  };
}
