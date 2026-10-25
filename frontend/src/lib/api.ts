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
  color?: string;
}

export type MembershipStatus = 'ACTIVE' | 'SUSPENDED' | 'TERMINATED';

export interface Member {
  id: string;
  nombre: string;
  apellido: string;
  dni: string;
  patente?: string;
  foto_url?: string;
  /** @deprecated Derivado de `status`. Se elimina al cerrar la ventana de compatibilidad. */
  activo: boolean;
  status: MembershipStatus;
  status_since?: string | null;
  status_until?: string | null;
  status_reason?: string | null;
  needs_review?: boolean;
  tipo_vehiculo?: string | null;
  categoria_id?: number | null;
  categoria_nombre?: string | null;
}

/** Resultado de una acción masiva. `member_ids` son los efectivamente aplicados. */
export interface BulkResult {
  applied: number;
  member_ids: string[];
}

export interface MembershipState {
  member_id: string;
  status: MembershipStatus;
  status_since: string | null;
  status_until: string | null;
  status_reason: string | null;
  period_id: string | null;
  needs_review: boolean;
}

export interface MembershipPeriod {
  id: string;
  kind: 'SUSPENSION' | 'TERMINATION';
  effective_from: string;
  effective_until: string | null;
  reason: string;
  created_at: string;
  created_by_username: string | null;
  closed_at: string | null;
  closed_by_username: string | null;
  close_reason: string | null;
  cancelled_at: string | null;
  legacy_migrated: boolean;
}

export interface MembershipEvent {
  id: string;
  action: string;
  reason: string | null;
  performed_at: string;
  performed_by_username: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
}

export interface MembershipHistory {
  periods: MembershipPeriod[];
  events: MembershipEvent[];
  empty: boolean;
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

// ── Analytics types ───────────────────────────────────────────────────────────

export interface AnalyticsDateRange { from: string; to: string; categoryId?: number }

export interface OverviewData {
  total_checkins: number;
  unique_members: number;
  active_members: number;
  checkins_prev_period: number;
  trend_pct: number | null;
  avg_daily: number;
  by_day: { date: string; count: number }[];
  top_members: { id: string; nombre: string; apellido: string; count: number }[];
  inactive_members: { id: string; nombre: string; apellido: string; last_checkin: string | null }[];
  active_categories: { id: number; nombre: string; count: number }[];
}

export interface CategoryAnalytics {
  categoria: { id: number; nombre: string };
  total_checkins: number;
  unique_members: number;
  active_members: number;
  by_day: { date: string; count: number }[];
  members: {
    id: string; nombre: string; apellido: string;
    count: number; avg_hour: number | null; last_checkin: string | null;
  }[];
  schedules: {
    id: number; day_of_week: number; start_time: string;
    tolerance_min: number; valid_from: string; valid_until: string | null;
  }[];
}

export interface MemberAnalytics {
  member: { id: string; nombre: string; apellido: string; categoria_id: number | null; categoria_nombre: string | null };
  total_checkins: number;
  avg_hour: number | null;
  sessions_expected: number;
  attendance_pct: number | null;
  days_since_last: number | null;
  history: { date: string; hour_decimal: number; schedule_match: 'early' | 'on_time' | 'late' | 'unscheduled' | null }[];
}

export interface TrafficData {
  by_hour: { hour: number; count: number }[];
  by_weekday: { weekday: number; count: number }[];
  heatmap: { weekday: number; hour: number; count: number }[];
}

export interface Insight { type: string; severity: 'info' | 'warning'; message: string; data?: unknown }

export interface TrainingSchedule {
  id: number; categoria_id: number; categoria_nombre?: string;
  day_of_week: number; start_time: string; tolerance_min: number;
  valid_from: string; valid_until: string | null;
}

export interface DashboardCategoria {
  id: number;
  nombre: string;
  activos: number;
  ultimo_ingreso: string | null;
  estado: 'ok' | 'warn' | 'alert';
}

export interface DashboardData {
  pendientes: {
    descolgados: number;
    a_revisar: number;
    sin_foto: number;
    horarios: number;
  };
  club: {
    activos: number;
    suspendidos: number;
    bajas: number;
    ingresos_7d: number;
    jugadores_7d: number;
  };
  categorias: DashboardCategoria[];
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
    request<{
      type: string; nombre?: string; apellido?: string; username?: string;
      dni?: string; patente?: string; foto_url?: string; estacionamiento?: string;
      membership?: { status: MembershipStatus; since: string | null; until: string | null; reason: string | null };
    }>('/auth/me'),

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

  getCarnetQr: () =>
    request<{ qr: string }>('/portero/carnet-qr'),

  checkInByMember: (member_id: string) =>
    request<{ ok: boolean; member: { nombre: string; apellido: string }; already: boolean }>(
      '/check-in/by-member',
      { method: 'POST', body: JSON.stringify({ member_id }) }
    ),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: boolean }>('/auth/change-password', { method: 'PUT', body: JSON.stringify({ currentPassword, newPassword }) }),

  forgotPassword: (dni: string) =>
    request<{ ok: boolean }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ dni }) }),

  resetPassword: (token: string, newPassword: string) =>
    request<{ ok: boolean }>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) }),

  getMembers: (status?: MembershipStatus) =>
    request<Member[]>(`/admin/members${status ? `?status=${status}` : ''}`),

  // ── Membresía administrativa ────────────────────────────────────────────────
  suspendMember: (id: string, data: { effective_from?: string; effective_until?: string | null; reason: string }) =>
    request<{ period: MembershipPeriod; state: MembershipState }>(
      `/admin/members/${id}/suspend`,
      { method: 'POST', body: JSON.stringify(data) }
    ),

  terminateMember: (id: string, data: { effective_from?: string; reason: string }) =>
    request<{ period: MembershipPeriod; state: MembershipState }>(
      `/admin/members/${id}/terminate`,
      { method: 'POST', body: JSON.stringify(data) }
    ),

  reactivateMember: (id: string, data: { effective_from?: string; reason?: string } = {}) =>
    request<{ status: MembershipStatus; noop: boolean; state: MembershipState }>(
      `/admin/members/${id}/reactivate`,
      { method: 'POST', body: JSON.stringify(data) }
    ),

  // ── Acciones masivas ────────────────────────────────────────────────────────
  // El lote es atómico: el 409 llega con el mensaje del backend ya nombrando a
  // los jugadores en conflicto, y `request` lo propaga tal cual en el Error.
  bulkSuspendMembers: (data: {
    member_ids: string[];
    effective_from?: string;
    effective_until?: string | null;
    reason: string;
  }) =>
    request<BulkResult>('/admin/members/bulk/suspend', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  bulkTerminateMembers: (data: { member_ids: string[]; effective_from?: string; reason: string }) =>
    request<BulkResult>('/admin/members/bulk/terminate', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  bulkReactivateMembers: (data: { member_ids: string[]; effective_from?: string; reason?: string }) =>
    request<BulkResult>('/admin/members/bulk/reactivate', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getMembership: (id: string) =>
    request<MembershipState>(`/admin/members/${id}/membership`),

  getMembershipHistory: (id: string) =>
    request<MembershipHistory>(`/admin/members/${id}/membership/history`),

  createMember: (data: { nombre: string; apellido: string; dni: string; patente?: string; password: string; categoria_id?: number | null; tipo_vehiculo?: string | null }) =>
    request<Member>('/admin/members', { method: 'POST', body: JSON.stringify(data) }),

  updateMember: (id: string, data: Partial<Member & { password: string }>) =>
    request<Member>(`/admin/members/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // deleteMember se retiró: el borrado físico destruía el historial de
  // asistencias (check_ins tiene ON DELETE CASCADE). Usar terminateMember.

  getStats: () =>
    request<{ today: number; activos: number; suspendidos: number; bajas: number; total: number }>(
      '/admin/stats'
    ),

  getDashboard: () =>
    request<DashboardData>('/admin/dashboard'),

  getCategorias: () =>
    request<Categoria[]>('/categorias'),

  createCategoria: (nombre: string, color?: string) =>
    request<Categoria>('/categorias', { method: 'POST', body: JSON.stringify({ nombre, ...(color ? { color } : {}) }) }),

  deleteCategoria: (id: number) =>
    request<{ ok: boolean }>(`/categorias/${id}`, { method: 'DELETE' }),

  updateCategoria: async (id: number, data: Partial<{ nombre: string; color: string }>): Promise<Categoria> => {
    const res = await fetch(`${BASE}/categorias/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Error actualizando categoría');
    return res.json();
  },

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

  analyticsOverview: (params: AnalyticsDateRange) => {
    const q = new URLSearchParams({ from: params.from, to: params.to });
    if (params.categoryId != null) q.set('categoryId', String(params.categoryId));
    return request<OverviewData>(`/admin/analytics/overview?${q}`);
  },
  analyticsCategory: (id: number, params: AnalyticsDateRange) => {
    const q = new URLSearchParams({ from: params.from, to: params.to });
    return request<CategoryAnalytics>(`/admin/analytics/categories/${id}?${q}`);
  },
  analyticsMember: (id: string, params: AnalyticsDateRange) => {
    const q = new URLSearchParams({ from: params.from, to: params.to });
    return request<MemberAnalytics>(`/admin/analytics/members/${id}?${q}`);
  },
  analyticsTraffic: (params: AnalyticsDateRange) => {
    const q = new URLSearchParams({ from: params.from, to: params.to });
    if (params.categoryId != null) q.set('categoryId', String(params.categoryId));
    return request<TrafficData>(`/admin/analytics/traffic?${q}`);
  },
  analyticsInsights: (params: AnalyticsDateRange) => {
    const q = new URLSearchParams({ from: params.from, to: params.to });
    return request<Insight[]>(`/admin/analytics/insights?${q}`);
  },
  getTrainingSchedules: (categoriaId?: number) => {
    const q = categoriaId != null ? `?categoriaId=${categoriaId}` : '';
    return request<TrainingSchedule[]>(`/admin/training-schedules${q}`);
  },
  createTrainingSchedule: (data: Omit<TrainingSchedule, 'id' | 'categoria_nombre'>) =>
    request<TrainingSchedule>('/admin/training-schedules', { method: 'POST', body: JSON.stringify(data) }),
  deleteTrainingSchedule: (id: number) =>
    request<{ ok: boolean }>(`/admin/training-schedules/${id}`, { method: 'DELETE' }),
};
