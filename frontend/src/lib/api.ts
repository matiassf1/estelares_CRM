const BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('token');
}

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

export interface Categoria {
  id: number;
  nombre: string;
  orden: number;
}

export interface Member {
  id: string;
  nombre: string;
  apellido: string;
  dni: string;
  patente?: string;
  foto_url?: string;
  activo: boolean;
  tipo_vehiculo?: string | null;
  categoria_id?: number | null;
  categoria_nombre?: string | null;
}

export interface ParkingSpot {
  id: number;
  spot_number: string;
  member_id: string | null;
  nombre: string | null;
  apellido: string | null;
  patente: string | null;
}

export interface CheckInEntry {
  nombre: string;
  apellido: string;
  patente?: string;
  tipo_vehiculo?: string | null;
  checked_in_at: string;
}

export const api = {
  login: (dni: string, password: string) =>
    request<{ token: string; user: { nombre: string; apellido: string; dni: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ dni, password }),
    }),

  adminLogin: (username: string, password: string) =>
    request<{ token: string; user: { username: string; role: string } }>('/auth/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  me: () =>
    request<{ type: string; nombre?: string; apellido?: string; username?: string; dni?: string; patente?: string; foto_url?: string; estacionamiento?: string }>('/auth/me'),

  todayStatus: () =>
    request<{ ingresado: boolean; hora?: string }>('/check-in/today-status'),

  checkIn: (token: string) =>
    request<{ ok: boolean; member: { nombre: string; apellido: string } }>('/check-in', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  todayCheckIns: () =>
    request<CheckInEntry[]>('/check-in/today'),

  getPorteroQr: () =>
    request<{ qr: string; token: string; expiresIn: number }>('/portero/qr'),

  getMembers: () =>
    request<Member[]>('/admin/members'),

  createMember: (data: { nombre: string; apellido: string; dni: string; patente?: string; password: string; categoria_id?: number | null; tipo_vehiculo?: string | null }) =>
    request<Member>('/admin/members', { method: 'POST', body: JSON.stringify(data) }),

  updateMember: (id: string, data: Partial<Member & { password: string }>) =>
    request<Member>(`/admin/members/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteMember: (id: string) =>
    request<{ ok: boolean }>(`/admin/members/${id}`, { method: 'DELETE' }),

  getStats: () =>
    request<{ today: number; total: number }>('/admin/stats'),

  getCategorias: () =>
    request<Categoria[]>('/categorias'),

  createCategoria: (nombre: string) =>
    request<Categoria>('/categorias', { method: 'POST', body: JSON.stringify({ nombre }) }),

  deleteCategoria: (id: number) =>
    request<{ ok: boolean }>(`/categorias/${id}`, { method: 'DELETE' }),

  getParkingSpots: () =>
    request<ParkingSpot[]>('/parking'),

  createParkingSpot: (spot_number: string) =>
    request<ParkingSpot>('/parking', { method: 'POST', body: JSON.stringify({ spot_number }) }),

  assignParking: (id: number, member_id: string) =>
    request<ParkingSpot>(`/parking/${id}/assign`, { method: 'PUT', body: JSON.stringify({ member_id }) }),

  unassignParking: (id: number) =>
    request<ParkingSpot>(`/parking/${id}/unassign`, { method: 'PUT' }),

  deleteParking: (id: number) =>
    request<{ ok: boolean }>(`/parking/${id}`, { method: 'DELETE' }),
};
