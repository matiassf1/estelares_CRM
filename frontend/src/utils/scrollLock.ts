/**
 * Prevents body scroll (iOS Safari fix for position:fixed overlays).
 * Sets body to position:fixed so iOS treats fixed children correctly.
 * Returns an unlock function to call on cleanup.
 */
export function lockBodyScroll(): () => void {
  const scrollY = window.scrollY;
  document.body.dataset.scrollY = String(scrollY);
  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';
  return () => {
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    delete document.body.dataset.scrollY;
    window.scrollTo(0, scrollY);
  };
}
