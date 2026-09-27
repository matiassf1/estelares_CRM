/**
 * Prevents body scroll (iOS Safari fix for position:fixed overlays).
 * Sets body to position:fixed so iOS treats fixed children correctly.
 * Returns an unlock function to call on cleanup.
 */
export function lockBodyScroll(): () => void {
  const scrollY = window.scrollY;
  document.body.style.overflow = 'hidden';
  document.body.style.position = 'fixed';
  document.body.style.top = `-${scrollY}px`;
  document.body.style.width = '100%';
  return () => {
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    window.scrollTo(0, scrollY);
  };
}
