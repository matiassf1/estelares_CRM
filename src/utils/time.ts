const TZ = 'America/Argentina/Buenos_Aires';

export function todayArgentina(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
}
