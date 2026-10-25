import { PoolClient } from 'pg';
import { pool } from '../db';

export type MembershipStatus = 'ACTIVE' | 'SUSPENDED' | 'TERMINATED';

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
  member_id: string;
  kind: 'SUSPENSION' | 'TERMINATION';
  effective_from: string;
  effective_until: string | null;
  reason: string;
  created_by: string;
  created_at: string;
  closed_at: string | null;
  closed_by: string | null;
  close_reason: string | null;
  cancelled_at: string | null;
  legacy_migrated: boolean;
}

/** Error de dominio con código HTTP. Lo traduce la capa de rutas. */
export class MembershipError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
    this.name = 'MembershipError';
  }
}

/**
 * Máxima retroactividad admitida para la fecha efectiva de una operación.
 * Decisión de negocio: permite corregir una omisión del mes anterior sin
 * habilitar reescrituras arbitrarias del pasado administrativo.
 */
export const MAX_RETROACTIVE_DAYS = 60;

/** Fecha de hoy en calendario argentino, con el mismo offset fijo que el resto del sistema. */
const TODAY_AR_SQL = `CAST((NOW() - INTERVAL '3 hours') AS DATE)`;

export async function todayAr(client: PoolClient | typeof pool = pool): Promise<string> {
  const { rows } = await client.query(`SELECT ${TODAY_AR_SQL} AS today`);
  return toDateString(rows[0].today);
}

/** Normaliza un DATE de pg (que llega como Date local) a 'YYYY-MM-DD' sin corrimiento de zona. */
export function toDateString(value: Date | string): string {
  if (typeof value === 'string') return value.slice(0, 10);
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function assertIsoDate(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new MembershipError(400, `${field} debe tener formato YYYY-MM-DD`);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new MembershipError(400, `${field} no es una fecha válida`);
  }
  return value;
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T00:00:00Z`).getTime();
  const b = new Date(`${toIso}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

function assertReason(reason: unknown, required: boolean): string | null {
  if (reason === undefined || reason === null || String(reason).trim() === '') {
    if (required) throw new MembershipError(400, 'El motivo es obligatorio');
    return null;
  }
  const trimmed = String(reason).trim();
  if (trimmed.length > 500) {
    throw new MembershipError(400, 'El motivo no puede superar los 500 caracteres');
  }
  return trimmed;
}

// ── Lectura ───────────────────────────────────────────────────────────────────

export async function getMembershipState(
  memberId: string,
  client: PoolClient | typeof pool = pool
): Promise<MembershipState> {
  const { rows } = await client.query(
    `SELECT member_id, status, status_since, status_until, status_reason, period_id, needs_review
     FROM member_membership_state WHERE member_id = $1`,
    [memberId]
  );
  if (!rows[0]) throw new MembershipError(404, 'Jugador no encontrado');
  return {
    ...rows[0],
    status_since: rows[0].status_since ? toDateString(rows[0].status_since) : null,
    status_until: rows[0].status_until ? toDateString(rows[0].status_until) : null,
  };
}

/**
 * Historial administrativo completo: períodos (incluidos cerrados y cancelados)
 * más los eventos de audit_log, en orden cronológico descendente.
 */
export async function getMembershipHistory(memberId: string) {
  const [periods, events] = await Promise.all([
    // Los períodos son la fuente de verdad y ya contienen todo lo que la línea
    // de tiempo necesita mostrar: tipo, fechas, motivo, autor y cierre. Sólo
    // faltan los nombres de usuario, que se resuelven acá.
    pool.query(
      `SELECT p.*,
              ac.username AS created_by_username,
              cl.username AS closed_by_username
       FROM membership_periods p
       LEFT JOIN admins ac ON ac.id = p.created_by
       LEFT JOIN admins cl ON cl.id = p.closed_by
       WHERE p.member_id = $1
       ORDER BY p.effective_from DESC, p.created_at DESC`,
      [memberId]
    ),
    pool.query(
      `SELECT a.id, a.action, a.old_value, a.new_value, a.reason, a.performed_at,
              ad.username AS performed_by_username
       FROM audit_log a
       LEFT JOIN admins ad ON ad.id = a.performed_by
       WHERE a.entity = 'member' AND a.entity_id = $1
       ORDER BY a.performed_at DESC`,
      [memberId]
    ),
  ]);
  return {
    periods: periods.rows.map(p => ({
      ...p,
      effective_from: toDateString(p.effective_from),
      effective_until: p.effective_until ? toDateString(p.effective_until) : null,
    })),
    events: events.rows,
    /** True cuando el jugador nunca tuvo movimientos administrativos. */
    empty: periods.rows.length === 0 && events.rows.length === 0,
  };
}

// ── Control de acceso físico ──────────────────────────────────────────────────

/**
 * Única barrera de ingreso del sistema (Regla A). La usan TODOS los endpoints
 * que registran un check-in. No alcanza con ocultar botones en el frontend:
 * la decisión se toma acá, del lado del servidor, contra el estado vigente.
 */
export function assertCanCheckIn(state: MembershipState): void {
  if (state.status === 'SUSPENDED') {
    throw new MembershipError(403, 'Membresía suspendida: no se permite el ingreso', {
      status: state.status,
      since: state.status_since,
      until: state.status_until,
    });
  }
  if (state.status === 'TERMINATED') {
    throw new MembershipError(403, 'Jugador dado de baja: no se permite el ingreso', {
      status: state.status,
      since: state.status_since,
    });
  }
}

// ── Auditoría ─────────────────────────────────────────────────────────────────

async function audit(
  client: PoolClient,
  params: {
    entity: string;
    entityId: string;
    action: string;
    oldValue?: unknown;
    newValue?: unknown;
    actorId: string;
    reason?: string | null;
  }
): Promise<void> {
  await client.query(
    `INSERT INTO audit_log (entity, entity_id, action, old_value, new_value,
                            performed_by, performed_by_type, reason)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, 'admin', $7)`,
    [
      params.entity,
      params.entityId,
      params.action,
      params.oldValue === undefined ? null : JSON.stringify(params.oldValue),
      params.newValue === undefined ? null : JSON.stringify(params.newValue),
      params.actorId,
      params.reason ?? null,
    ]
  );
}

// ── Infraestructura transaccional ─────────────────────────────────────────────

/**
 * Ejecuta una transición dentro de una transacción, tomando FOR UPDATE sobre la
 * fila del jugador. Eso serializa dos transiciones concurrentes del mismo
 * jugador; el constraint EXCLUDE de la base es la red de último recurso.
 * Mismo patrón transaccional que routes/parking.ts.
 */
/** Datos del jugador que el lock deja disponibles dentro de la transacción. */
interface LockedMember {
  id: string;
  createdAt: string;
  nombre: string;
  apellido: string;
}

/** Nombre legible para los mensajes de error: un UUID no le dice nada a nadie. */
function displayName(m: LockedMember): string {
  return `${m.apellido}, ${m.nombre}`.trim();
}

/**
 * Abre la transacción, toma FOR UPDATE sobre los jugadores indicados y ejecuta.
 * Cualquier error hace ROLLBACK: por eso un lote es atómico sin lógica extra.
 *
 * El ORDER BY id no es decorativo: dos lotes concurrentes con jugadores en
 * común tomarían los locks en órdenes distintos y se trabarían mutuamente
 * (deadlock). Con un orden determinista uno espera al otro.
 */
async function withMembersLock<T>(
  memberIds: string[],
  fn: (client: PoolClient, members: LockedMember[]) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT id, created_at, nombre, apellido FROM members
       WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE`,
      [memberIds]
    );
    const members: LockedMember[] = rows.map(r => ({
      id: r.id,
      createdAt: toDateString(r.created_at),
      nombre: r.nombre,
      apellido: r.apellido,
    }));
    if (members.length !== memberIds.length) {
      throw new MembershipError(404, 'Jugador no encontrado', {
        missing: memberIds.filter(id => !members.some(m => m.id === id)),
      });
    }
    const result = await fn(client, members);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    // 23P01 = exclusion_violation. Sólo puede ocurrir en una carrera que el
    // FOR UPDATE no cubra; se traduce a un 409 legible en vez de un 500.
    if ((err as { code?: string }).code === '23P01') {
      throw new MembershipError(409, 'Existe otro período administrativo que se superpone con las fechas indicadas');
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Ejecuta una transición sobre un único jugador. Caso particular del lock de
 * lote, para no tener dos formas de abrir la misma transacción.
 */
async function withMemberLock<T>(
  memberId: string,
  fn: (client: PoolClient, memberCreatedAt: string) => Promise<T>
): Promise<T> {
  return withMembersLock([memberId], (client, members) => fn(client, members[0].createdAt));
}

/**
 * members.activo es una SALIDA DERIVADA durante la ventana de compatibilidad:
 * lo escribe únicamente este servicio y nadie lo lee como verdad. Existe sólo
 * para que un rollback del código no requiera un rollback de datos. Se elimina
 * en una migración posterior.
 */
async function syncLegacyActivo(client: PoolClient, memberId: string): Promise<void> {
  await client.query(
    `UPDATE members m
     SET activo = (s.status = 'ACTIVE')
     FROM member_membership_state s
     WHERE s.member_id = m.id AND m.id = $1`,
    [memberId]
  );
}

function validateEffectiveFrom(
  effectiveFrom: string,
  today: string,
  memberCreatedAt: string
): void {
  const retro = daysBetween(effectiveFrom, today);
  if (retro > MAX_RETROACTIVE_DAYS) {
    throw new MembershipError(
      400,
      `La fecha efectiva no puede ser anterior a ${MAX_RETROACTIVE_DAYS} días`
    );
  }
  if (effectiveFrom < memberCreatedAt) {
    throw new MembershipError(
      400,
      'La fecha efectiva no puede ser anterior al alta del jugador'
    );
  }
}

// ── Reglas de transición ──────────────────────────────────────────────────────
// Separadas del cuerpo de cada operación para que la validación previa del lote
// y la aplicación individual compartan exactamente el mismo criterio.

function suspendConflict(state: MembershipState): string | null {
  if (state.status === 'SUSPENDED') return 'ya tiene una suspensión vigente';
  if (state.status === 'TERMINATED') return 'está dado de baja; reactivalo antes de suspenderlo';
  return null;
}

function terminateConflict(state: MembershipState): string | null {
  return state.status === 'TERMINATED' ? 'ya está dado de baja' : null;
}

function assertCanSuspend(state: MembershipState): void {
  if (state.status === 'SUSPENDED') {
    throw new MembershipError(409, 'El jugador ya tiene una suspensión vigente', state);
  }
  if (state.status === 'TERMINATED') {
    throw new MembershipError(
      409,
      'El jugador está dado de baja. Reactivalo antes de suspenderlo.',
      state
    );
  }
}

function assertCanTerminate(state: MembershipState): void {
  if (state.status === 'TERMINATED') {
    throw new MembershipError(409, 'El jugador ya está dado de baja', state);
  }
}

// ── Transiciones ──────────────────────────────────────────────────────────────

export interface SuspendInput {
  memberId: string;
  effectiveFrom?: string;
  effectiveUntil?: string | null;
  reason: string;
  actorId: string;
}

interface SuspendOpts {
  effectiveFrom?: string;
  effectiveUntil?: string | null;
  reason: string;
  actorId: string;
}

/**
 * Cuerpo de la suspensión dentro de una transacción ya abierta, con el lock del
 * jugador tomado. Única fuente de verdad: la comparten `suspend` y `bulkSuspend`.
 * `reason` llega ya normalizado por `assertReason`.
 */
async function suspendTx(
  client: PoolClient,
  member: LockedMember,
  opts: SuspendOpts
): Promise<MembershipPeriod> {
  const today = await todayAr(client);
  const from = opts.effectiveFrom ? assertIsoDate(opts.effectiveFrom, 'effective_from') : today;
  const until = opts.effectiveUntil ? assertIsoDate(opts.effectiveUntil, 'effective_until') : null;

  validateEffectiveFrom(from, today, member.createdAt);
  if (until && until <= from) {
    throw new MembershipError(400, 'La fecha de finalización debe ser posterior a la de inicio');
  }

  const state = await getMembershipState(member.id, client);
  assertCanSuspend(state);

  const { rows } = await client.query(
    `INSERT INTO membership_periods
       (member_id, kind, effective_from, effective_until, reason, created_by)
     VALUES ($1, 'SUSPENSION', $2, $3, $4, $5)
     RETURNING *`,
    [member.id, from, until, opts.reason, opts.actorId]
  );

  await audit(client, {
    entity: 'member',
    entityId: member.id,
    action: 'suspended',
    oldValue: { status: state.status },
    newValue: { status: 'SUSPENDED', effective_from: from, effective_until: until },
    actorId: opts.actorId,
    reason: opts.reason,
  });
  await syncLegacyActivo(client, member.id);
  return rows[0];
}

export async function suspend(input: SuspendInput): Promise<MembershipPeriod> {
  const reason = assertReason(input.reason, true)!;
  return withMembersLock([input.memberId], (client, members) =>
    suspendTx(client, members[0], { ...input, reason })
  );
}

export interface TerminateInput {
  memberId: string;
  effectiveFrom?: string;
  reason: string;
  actorId: string;
}

interface TerminateOpts {
  effectiveFrom?: string;
  reason: string;
  actorId: string;
}

async function terminateTx(
  client: PoolClient,
  member: LockedMember,
  opts: TerminateOpts
): Promise<MembershipPeriod> {
  const today = await todayAr(client);
  const from = opts.effectiveFrom ? assertIsoDate(opts.effectiveFrom, 'effective_from') : today;
  validateEffectiveFrom(from, today, member.createdAt);

  const state = await getMembershipState(member.id, client);
  assertCanTerminate(state);

  // Una suspensión vigente se cierra para no solapar con la baja. Si la baja
  // es retroactiva y cae antes del inicio de la suspensión, se cancela el
  // período completo en vez de producir un rango inválido.
  if (state.status === 'SUSPENDED' && state.period_id) {
    if (state.status_since && from <= state.status_since) {
      await client.query(`UPDATE membership_periods SET cancelled_at = NOW() WHERE id = $1`, [
        state.period_id,
      ]);
    } else {
      await client.query(
        `UPDATE membership_periods
         SET effective_until = $2, closed_at = NOW(), closed_by = $3,
             close_reason = 'Cerrada por baja definitiva'
         WHERE id = $1`,
        [state.period_id, from, opts.actorId]
      );
    }
  }

  const { rows } = await client.query(
    `INSERT INTO membership_periods
       (member_id, kind, effective_from, effective_until, reason, created_by)
     VALUES ($1, 'TERMINATION', $2, NULL, $3, $4)
     RETURNING *`,
    [member.id, from, opts.reason, opts.actorId]
  );

  // Regla F: la baja libera la cochera en la MISMA transacción. Se captura el
  // valor anterior antes del UPDATE porque parking_spots no tiene historial
  // propio: audit_log.old_value es la única trazabilidad posible hoy.
  const { rows: spots } = await client.query(
    'SELECT id, spot_number FROM parking_spots WHERE member_id = $1',
    [member.id]
  );
  if (spots.length > 0) {
    await client.query('UPDATE parking_spots SET member_id = NULL WHERE member_id = $1', [
      member.id,
    ]);
    for (const spot of spots) {
      await audit(client, {
        entity: 'parking_spot',
        // audit_log.entity_id es UUID y parking_spots.id es SERIAL, por lo que
        // no entra. Se ancla al jugador (que es de quien trata la operación) y
        // el espacio concreto queda identificado en el payload JSONB.
        entityId: member.id,
        action: 'released_on_termination',
        oldValue: { spot_id: spot.id, spot_number: spot.spot_number, member_id: member.id },
        newValue: { spot_id: spot.id, spot_number: spot.spot_number, member_id: null },
        actorId: opts.actorId,
        reason: 'Baja administrativa del jugador',
      });
    }
  }

  await audit(client, {
    entity: 'member',
    entityId: member.id,
    action: 'terminated',
    oldValue: { status: state.status },
    newValue: {
      status: 'TERMINATED',
      effective_from: from,
      parking_released: spots.map(s => s.spot_number),
    },
    actorId: opts.actorId,
    reason: opts.reason,
  });
  await syncLegacyActivo(client, member.id);
  return rows[0];
}

export async function terminate(input: TerminateInput): Promise<MembershipPeriod> {
  const reason = assertReason(input.reason, true)!;
  return withMembersLock([input.memberId], (client, members) =>
    terminateTx(client, members[0], { ...input, reason })
  );
}

export interface ReactivateInput {
  memberId: string;
  effectiveFrom?: string;
  reason?: string | null;
  actorId: string;
}

export interface ReactivateResult {
  status: MembershipStatus;
  noop: boolean;
  closed_period_id: string | null;
}

interface ReactivateOpts {
  effectiveFrom?: string;
  reason: string | null;
  actorId: string;
}

async function reactivateTx(
  client: PoolClient,
  member: LockedMember,
  opts: ReactivateOpts
): Promise<ReactivateResult> {
  const today = await todayAr(client);
  const from = opts.effectiveFrom ? assertIsoDate(opts.effectiveFrom, 'effective_from') : today;
  validateEffectiveFrom(from, today, member.createdAt);

  const state = await getMembershipState(member.id, client);
  if (state.status === 'ACTIVE') {
    // Idempotente: el resultado deseado ya es el estado actual.
    return { status: 'ACTIVE' as const, noop: true, closed_period_id: null };
  }

  const periodId = state.period_id!;
  if (state.status_since && from <= state.status_since) {
    // Reactivación anterior al inicio del período: el período no llegó a
    // tener efecto, se cancela en vez de dejar un rango vacío o inválido.
    await client.query(`UPDATE membership_periods SET cancelled_at = NOW() WHERE id = $1`, [
      periodId,
    ]);
  } else {
    await client.query(
      `UPDATE membership_periods
       SET effective_until = $2, closed_at = NOW(), closed_by = $3, close_reason = $4
       WHERE id = $1`,
      [periodId, from, opts.actorId, opts.reason]
    );
  }

  await audit(client, {
    entity: 'member',
    entityId: member.id,
    action: 'reactivated',
    oldValue: { status: state.status, since: state.status_since, until: state.status_until },
    newValue: { status: 'ACTIVE', effective_from: from, closed_period_id: periodId },
    actorId: opts.actorId,
    reason: opts.reason,
  });
  await syncLegacyActivo(client, member.id);
  return { status: 'ACTIVE' as const, noop: false, closed_period_id: periodId };
}

/**
 * Cierra el período restrictivo vigente. No crea un jugador nuevo, no toca
 * created_at, categoria_id ni check_ins (Regla D). No reasigna la cochera (Regla F).
 */
export async function reactivate(input: ReactivateInput): Promise<ReactivateResult> {
  const reason = assertReason(input.reason, false);
  return withMembersLock([input.memberId], (client, members) =>
    reactivateTx(client, members[0], { ...input, reason })
  );
}

// ── Acciones masivas ──────────────────────────────────────────────────────────

export interface BulkResult {
  applied: number;
  member_ids: string[];
}

/**
 * Tope de cordura: el club tiene 108 jugadores. Un lote mayor es un error de
 * la interfaz o un intento de bloquear la tabla entera dentro de una sola
 * transacción.
 */
export const BULK_MAX_MEMBERS = 200;

function normalizeMemberIds(memberIds: unknown): string[] {
  if (!Array.isArray(memberIds) || memberIds.length === 0) {
    throw new MembershipError(400, 'Seleccioná al menos un jugador');
  }
  // Duplicados: no es un error del usuario, es ruido de la selección.
  const unique = Array.from(new Set(memberIds.map(String)));
  if (unique.length > BULK_MAX_MEMBERS) {
    throw new MembershipError(
      400,
      `No se pueden procesar más de ${BULK_MAX_MEMBERS} jugadores en un mismo lote`
    );
  }
  return unique;
}

/**
 * Valida la transición de TODOS antes de aplicar la de ninguno, y arma un
 * mensaje que nombra a los jugadores en conflicto: quien tiene que sacarlos de
 * la selección no puede hacerlo con un UUID.
 */
async function assertNoConflicts(
  client: PoolClient,
  members: LockedMember[],
  conflictOf: (state: MembershipState) => string | null
): Promise<void> {
  const conflicts: { member_id: string; nombre: string; motivo: string }[] = [];
  for (const member of members) {
    const motivo = conflictOf(await getMembershipState(member.id, client));
    if (motivo) conflicts.push({ member_id: member.id, nombre: displayName(member), motivo });
  }
  if (conflicts.length === 0) return;
  const detalle = conflicts.map(c => `${c.nombre} (${c.motivo})`).join('; ');
  throw new MembershipError(
    409,
    `No se aplicó ningún cambio. ${conflicts.length === 1 ? 'Un jugador' : `${conflicts.length} jugadores`} no admiten la operación: ${detalle}`,
    { conflicts }
  );
}

export async function bulkSuspend(input: {
  memberIds: string[];
  effectiveFrom?: string;
  effectiveUntil?: string | null;
  reason: string;
  actorId: string;
}): Promise<BulkResult> {
  const ids = normalizeMemberIds(input.memberIds);
  const reason = assertReason(input.reason, true)!;
  return withMembersLock(ids, async (client, members) => {
    await assertNoConflicts(client, members, suspendConflict);
    for (const member of members) {
      await suspendTx(client, member, { ...input, reason });
    }
    return { applied: members.length, member_ids: members.map(m => m.id) };
  });
}

export async function bulkTerminate(input: {
  memberIds: string[];
  effectiveFrom?: string;
  reason: string;
  actorId: string;
}): Promise<BulkResult> {
  const ids = normalizeMemberIds(input.memberIds);
  const reason = assertReason(input.reason, true)!;
  return withMembersLock(ids, async (client, members) => {
    await assertNoConflicts(client, members, terminateConflict);
    for (const member of members) {
      await terminateTx(client, member, { ...input, reason });
    }
    return { applied: members.length, member_ids: members.map(m => m.id) };
  });
}

/**
 * Reactivar a alguien que ya está activo es no-op, igual que en la versión
 * individual: no hay conflicto que validar y no hace fallar el lote. `applied`
 * cuenta sólo a los que efectivamente cambiaron de estado.
 */
export async function bulkReactivate(input: {
  memberIds: string[];
  effectiveFrom?: string;
  reason?: string | null;
  actorId: string;
}): Promise<BulkResult> {
  const ids = normalizeMemberIds(input.memberIds);
  const reason = assertReason(input.reason, false);
  return withMembersLock(ids, async (client, members) => {
    const applied: string[] = [];
    for (const member of members) {
      const result = await reactivateTx(client, member, { ...input, reason });
      if (!result.noop) applied.push(member.id);
    }
    return { applied: applied.length, member_ids: applied };
  });
}


/**
 * Cancela un período cargado por error. No es una reactivación: borra el hecho
 * del estado vigente dejando constancia en auditoría.
 */
export async function cancelPeriod(
  periodId: string,
  actorId: string,
  reason: string
): Promise<void> {
  const trimmed = assertReason(reason, true)!;
  const { rows } = await pool.query(
    'SELECT member_id FROM membership_periods WHERE id = $1 AND cancelled_at IS NULL',
    [periodId]
  );
  if (!rows[0]) throw new MembershipError(404, 'Período no encontrado o ya cancelado');

  await withMemberLock(rows[0].member_id, async client => {
    await client.query('UPDATE membership_periods SET cancelled_at = NOW() WHERE id = $1', [
      periodId,
    ]);
    await audit(client, {
      entity: 'member',
      entityId: rows[0].member_id,
      action: 'suspension_cancelled',
      newValue: { period_id: periodId },
      actorId,
      reason: trimmed,
    });
    await syncLegacyActivo(client, rows[0].member_id);
  });
}
