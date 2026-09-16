const TZ = 'America/Argentina/Buenos_Aires';

export function todayArgentina(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
}

/**
 * SQL expression that converts a TIMESTAMP (stored as UTC wall-clock via NOW())
 * to the Argentina calendar date. Must stay in sync with uniq_member_checkin_day
 * in db.ts — AT TIME ZONE on TIMESTAMP WITHOUT TIME ZONE is wrong here because
 * Postgres treats the value as already being in that zone.
 */
export const CHECKED_IN_DATE_AR =
  "CAST((checked_in_at - INTERVAL '3 hours') AS DATE)";
