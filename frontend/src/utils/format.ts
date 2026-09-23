// Format DNI string to Argentine dot-separated format: "46526763" → "46.526.763"
export function formatDni(d: string): string {
  const digits = d.replace(/\D/g, '');
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Title-case a string respecting es-AR locale (handles Ñ, accented chars)
export function titleCase(s: string): string {
  return s
    .toLocaleLowerCase('es-AR')
    .replace(/(^\w|\s\w)/gu, c => c.toLocaleUpperCase('es-AR'));
}

// Format full name as "Apellido, Nombre" in Title Case
export function formatPlayerName(apellido: string, nombre: string): string {
  return `${titleCase(apellido)}, ${titleCase(nombre)}`;
}

// Get 2-letter initials from apellido + nombre: "SB" from "Barraza"/"Solana"
export function getInitials(apellido: string, nombre: string): string {
  const a = (apellido || '').trim()[0] || '';
  const b = (nombre || '').trim()[0] || '';
  return (a + b).toUpperCase();
}
