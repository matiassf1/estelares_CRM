import crypto from 'crypto';

function getSecret(): string {
  if (!process.env.ASSOC_QR_SECRET) throw new Error('ASSOC_QR_SECRET env var is required');
  return process.env.ASSOC_QR_SECRET;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseRaw(raw: string): { playerId: string; hmac: string } | null {
  const lastDot = raw.lastIndexOf('.');
  if (lastDot === -1) return null;
  const playerId = raw.slice(0, lastDot);
  const hmac = raw.slice(lastDot + 1);
  if (!UUID_REGEX.test(playerId)) return null;
  if (hmac.length !== 24) return null;
  return { playerId, hmac };
}

export function generatePlayerQr(playerId: string, qrSecret: string): string {
  const hmac = crypto
    .createHmac('sha256', getSecret())
    .update(`${playerId}:${qrSecret}`)
    .digest('hex')
    .slice(0, 24);
  return `${playerId}.${hmac}`;
}

export function verifyPlayerQr(raw: string, qrSecret: string): string | null {
  const parsed = parseRaw(raw);
  if (!parsed) return null;
  const expected = crypto
    .createHmac('sha256', getSecret())
    .update(`${parsed.playerId}:${qrSecret}`)
    .digest('hex')
    .slice(0, 24);
  if (expected !== parsed.hmac) return null;
  return parsed.playerId;
}

export function parsePlayerQrId(raw: string): string | null {
  return parseRaw(raw)?.playerId ?? null;
}

export function generateQrSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}
