const BASE = '/api/assoc';

function getToken(): string | null { return localStorage.getItem('assoc_token'); }
export function setAssocToken(t: string): void { localStorage.setItem('assoc_token', t); }
export function clearAssocToken(): void { localStorage.removeItem('assoc_token'); }

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error || 'Error');
  }
  return res.json();
}

export interface AssocMatch {
  id: string;
  home_team_name: string;
  home_club_name: string;
  away_team_name: string;
  away_club_name: string;
  season_name: string;
  scheduled_at: string;
  venue: string | null;
  status: 'SCHEDULED' | 'ACCREDITATION_OPEN' | 'IN_PROGRESS' | 'FINISHED' | 'CANCELLED';
}

export interface AccreditationResult {
  result: 'ACCREDITED' | 'ALREADY_ACCREDITED' | 'NOT_ELIGIBLE' | 'NOT_IN_MATCH' | 'INVALID_QR' | 'ACCREDITATION_CLOSED' | 'PLAYER_NOT_FOUND';
  player?: {
    id: string;
    firstName: string;
    lastName: string;
    photoUrl?: string | null;
    teamName: string;
  };
  accreditedAt?: string;
  status?: string;
  reason?: string;
}

export interface Accreditation {
  id: string;
  match_id: string;
  player_id: string;
  first_name: string;
  last_name: string;
  photo_url?: string | null;
  team_name: string;
  club_name: string;
  accredited_at: string;
  document_type?: string | null;
  document_number?: string | null;
}

export const assocApi = {
  login: (username: string, password: string) =>
    request<{ token: string; role: string; associationId: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  listMatches: () => request<AssocMatch[]>('/matches'),
  openAccreditation: (matchId: string) =>
    request<AssocMatch>(`/matches/${matchId}/open`, { method: 'PATCH' }),
  accredit: (matchId: string, qr: string) =>
    request<AccreditationResult>(`/matches/${matchId}/accredit`, {
      method: 'POST',
      body: JSON.stringify({ qr }),
    }),
  listAccreditations: (matchId: string) =>
    request<Accreditation[]>(`/matches/${matchId}/accreditations`),
  getCarnetQr: (playerId: string) =>
    request<{ qr: string; payload: string }>(`/players/${playerId}/carnet-qr`),
};
