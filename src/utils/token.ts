import crypto from 'crypto';

if (!process.env.QR_SECRET) throw new Error('QR_SECRET env var is required');
const QR_SECRET: string = process.env.QR_SECRET;
const WINDOW_SECONDS = 30;

export function getCurrentToken(): string {
  const window = Math.floor(Date.now() / 1000 / WINDOW_SECONDS);
  return crypto
    .createHmac('sha256', QR_SECRET)
    .update(window.toString())
    .digest('hex')
    .slice(0, 10);
}

export function isValidToken(token: string): boolean {
  const currentWindow = Math.floor(Date.now() / 1000 / WINDOW_SECONDS);
  // Accept current and previous window (grace period for scanning delay)
  for (let i = 0; i <= 1; i++) {
    const valid = crypto
      .createHmac('sha256', QR_SECRET)
      .update((currentWindow - i).toString())
      .digest('hex')
      .slice(0, 10);
    if (valid === token) return true;
  }
  return false;
}

export function secondsUntilNext(): number {
  return WINDOW_SECONDS - (Math.floor(Date.now() / 1000) % WINDOW_SECONDS);
}
