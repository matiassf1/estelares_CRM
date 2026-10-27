import { PoolClient } from 'pg';
import { pool } from '../db';
import {
  MembershipError,
  MembershipStatus,
  assertReason,
  audit,
  getMembershipState,
  todayAr,
  toDateString,
  withMembersLock,
  suspendTx,
  terminateTx,
  reactivateTx,
} from './membership';

/**
 * SOLICITUDES DE MEMBRESÍA INICIADAS POR EL JUGADOR
 * -------------------------------------------------
 * Una solicitud NO cambia el estado del jugador: queda como está hasta que un
 * administrador la aprueba. Lo que aporta es una intención registrada con fecha,
 * que es la prueba de cuándo el jugador avisó —exactamente la disputa que este
 * módulo viene a zanjar—.
 *
 * Toda transición real se delega en las funciones `*Tx` de `membership.ts`, que
 * son las que validan la transición, liberan la cochera y escriben la auditoría
 * del jugador. Acá no se replica nada de eso.
 */

export type RequestKind = 'SUSPENSION' | 'TERMINATION' | 'REACTIVATION';
export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface MembershipRequest {
  id: string;
  member_id: string;
  kind: RequestKind;
  effective_from: string;
  effective_until: string | null;
  reason: string;
  status: RequestStatus;
  requested_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
  period_id: string | null;
}

const KINDS: RequestKind[] = ['SUSPENSION', 'TERMINATION', 'REACTIVATION'];

/**
 * Tope de anticipación. Un pedido a más de medio año no es una planificación,
 * es ruido que el administrador va a tener en la bandeja hasta olvidarse de él.
 */
export const MAX_ADVANCE_DAYS = 180;

/**
 * Qué puede pedir cada estado, espejo del menú que ya tiene el administrador.
 * Explícito y en un solo lugar para que agregar un estado obligue a decidir.
 */
const ALLOWED_BY_STATUS: Record<MembershipStatus, RequestKind[]> = {
  ACTIVE: ['SUSPENSION', 'TERMINATION'],
  SUSPENDED: ['REACTIVATION', 'TERMINATION'],
  TERMINATED: ['REACTIVATION'],
};

/** Mensaje que explica POR QUÉ no corresponde, no sólo que no se puede. */
function notAllowedMessage(status: MembershipStatus, kind: RequestKind): string {
  if (kind === 'SUSPENSION' && status === 'SUSPENDED') {
    return 'Ya tenés una suspensión vigente.';
  }
  if (kind === 'SUSPENSION' && status === 'TERMINATED') {
    return 'Estás dado de baja: primero pedí la reactivación.';
  }
  if (kind === 'TERMINATION' && status === 'TERMINATED') {
    return 'Ya estás dado de baja.';
  }
  if (kind === 'REACTIVATION' && status === 'ACTIVE') {
    return 'Tu membresía ya está activa: no hay nada que reactivar.';
  }
  return 'La solicitud no corresponde a tu situación actual.';
}

function assertKind(value: unknown): RequestKind {
  if (typeof value !== 'string' || !KINDS.includes(value as RequestKind)) {
    throw new MembershipError(400, `El tipo de solicitud debe ser uno de: ${KINDS.join(', ')}`);
  }
  return value as RequestKind;
}

function assertIsoDate(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new MembershipError(400, `${field} debe tener formato YYYY-MM-DD`);
  }
  if (Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())) {
    throw new MembershipError(400, `${field} no es una fecha válida`);
  }
  return value;
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T00:00:00Z`).getTime();
  const b = new Date(`${toIso}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

/** Normaliza las fechas de pg para que la API devuelva siempre 'YYYY-MM-DD'. */
function mapRow(row: Record<string, unknown>): MembershipRequest {
  return {
    ...row,
    effective_from: toDateString(row.effective_from as Date),
    effective_until: row.effective_until ? toDateString(row.effective_until as Date) : null,
  } as MembershipRequest;
}

// ── Lectura ───────────────────────────────────────────────────────────────────

export async function getPendingRequest(memberId: string): Promise<MembershipRequest | null> {
  const { rows } = await pool.query(
    `SELECT * FROM membership_requests WHERE member_id = $1 AND status = 'PENDING'`,
    [memberId]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

/**
 * Bandeja del administrador. Trae ya resueltos los datos del jugador y su estado
 * vigente: sin eso, la pantalla haría N consultas para pintar N filas.
 */
export async function listRequests(opts: { status?: string } = {}) {
  const status = opts.status;
  if (status !== undefined && !['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].includes(status)) {
    throw new MembershipError(400, 'Estado de solicitud inválido');
  }
  const { rows } = await pool.query(
    `SELECT r.*,
            m.apellido, m.nombre, m.dni, m.foto_url,
            c.nombre AS categoria_nombre,
            s.status AS member_status,
            ad.username AS resolved_by_username
     FROM membership_requests r
     JOIN members m ON m.id = r.member_id
     JOIN member_membership_state s ON s.member_id = r.member_id
     LEFT JOIN categorias c ON c.id = m.categoria_id
     LEFT JOIN admins ad ON ad.id = r.resolved_by
     WHERE ($1::text IS NULL OR r.status = $1)
     ORDER BY (r.status = 'PENDING') DESC, r.requested_at DESC`,
    [status ?? null]
  );
  return rows.map(r => ({
    ...mapRow(r),
    apellido: r.apellido,
    nombre: r.nombre,
    dni: r.dni,
    foto_url: r.foto_url,
    categoria_nombre: r.categoria_nombre,
    member_status: r.member_status as MembershipStatus,
    resolved_by_username: r.resolved_by_username,
  }));
}

// ── Alta por el jugador ───────────────────────────────────────────────────────

export interface CreateRequestInput {
  memberId: string;
  kind: unknown;
  effectiveFrom: unknown;
  effectiveUntil?: unknown;
  reason: unknown;
}

export async function createRequest(input: CreateRequestInput): Promise<MembershipRequest> {
  const kind = assertKind(input.kind);
  const reason = assertReason(input.reason, true)!;
  const from = assertIsoDate(input.effectiveFrom, 'effective_from');

  const hasUntil = input.effectiveUntil !== undefined && input.effectiveUntil !== null;
  if (hasUntil && kind !== 'SUSPENSION') {
    throw new MembershipError(
      400,
      'La fecha de finalización sólo se puede indicar en una suspensión'
    );
  }
  const until = hasUntil ? assertIsoDate(input.effectiveUntil, 'effective_until') : null;
  if (until && until <= from) {
    throw new MembershipError(400, 'La fecha de finalización debe ser posterior a la de inicio');
  }

  const today = await todayAr();
  // El jugador NO puede retroactivar: poner una fecha pasada sería afirmar que
  // avisó el mes anterior, que es exactamente la disputa que este módulo existe
  // para zanjar. El administrador sí puede, al aprobar.
  if (from < today) {
    throw new MembershipError(
      400,
      'La fecha no puede ser anterior a hoy: la solicitud deja constancia desde el momento en que la hacés'
    );
  }
  if (daysBetween(today, from) > MAX_ADVANCE_DAYS) {
    throw new MembershipError(
      400,
      `La fecha no puede ser posterior a ${MAX_ADVANCE_DAYS} días desde hoy`
    );
  }

  const state = await getMembershipState(input.memberId);
  if (!ALLOWED_BY_STATUS[state.status].includes(kind)) {
    throw new MembershipError(409, notAllowedMessage(state.status, kind), {
      status: state.status,
      kind,
    });
  }

  // El índice único parcial es la red de último recurso ante un doble envío;
  // esta consulta existe para dar un mensaje que el jugador entienda.
  if (await getPendingRequest(input.memberId)) {
    throw new MembershipError(409, 'Ya tenés una solicitud pendiente');
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO membership_requests (member_id, kind, effective_from, effective_until, reason)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [input.memberId, kind, from, until, reason]
    );
    return mapRow(rows[0]);
  } catch (err) {
    if ((err as { code?: string }).code === '23505') {
      throw new MembershipError(409, 'Ya tenés una solicitud pendiente');
    }
    throw err;
  }
}

/**
 * El jugador cancela la suya. Si el id existe pero es de otro, se responde 404 y
 * no 403: confirmar que existe una solicitud ajena ya sería filtrar información.
 */
export async function cancelRequest(
  requestId: string,
  memberId: string
): Promise<MembershipRequest> {
  const { rows } = await pool.query(
    `UPDATE membership_requests
     SET status = 'CANCELLED', resolved_at = NOW()
     WHERE id = $1 AND member_id = $2 AND status = 'PENDING'
     RETURNING *`,
    [requestId, memberId]
  );
  if (!rows[0]) throw new MembershipError(404, 'Solicitud no encontrada');
  return mapRow(rows[0]);
}

// ── Resolución por el administrador ───────────────────────────────────────────

export interface ApproveRequestInput {
  requestId: string;
  actorId: string;
  effectiveFrom?: unknown;
  effectiveUntil?: unknown;
  kind?: unknown;
  note?: unknown;
}

export interface ApproveResult {
  request: MembershipRequest;
  /** Tipo efectivamente aplicado, que puede diferir del pedido por el jugador. */
  applied_kind: RequestKind;
  period_id: string | null;
}

/**
 * Relee la solicitud DENTRO de la transacción. Si dejó de estar pendiente entre
 * el `SELECT` previo y acá, alguien la resolvió mientras tanto.
 */
async function lockPendingRequest(
  client: PoolClient,
  requestId: string
): Promise<Record<string, unknown>> {
  const { rows } = await client.query(
    `SELECT * FROM membership_requests WHERE id = $1 FOR UPDATE`,
    [requestId]
  );
  if (!rows[0]) throw new MembershipError(404, 'Solicitud no encontrada');
  if (rows[0].status !== 'PENDING') {
    throw new MembershipError(409, 'La solicitud ya fue resuelta', { status: rows[0].status });
  }
  return rows[0];
}

/**
 * Todo en una sola transacción: la transición y la resolución de la solicitud se
 * confirman juntas o no se confirma ninguna. Si la transición falla —por ejemplo
 * porque el jugador cambió de estado entre el pedido y la aprobación— el
 * ROLLBACK deja la solicitud PENDING, que es lo correcto: nadie la resolvió.
 */
export async function approveRequest(input: ApproveRequestInput): Promise<ApproveResult> {
  const note = assertReason(input.note, false);
  const overrideKind = input.kind === undefined || input.kind === null
    ? null
    : assertKind(input.kind);
  const overrideFrom = input.effectiveFrom === undefined || input.effectiveFrom === null
    ? null
    : assertIsoDate(input.effectiveFrom, 'effective_from');
  const hasOverrideUntil = input.effectiveUntil !== undefined && input.effectiveUntil !== null;
  const overrideUntil = hasOverrideUntil
    ? assertIsoDate(input.effectiveUntil, 'effective_until')
    : null;

  // Se necesita el member_id para tomar el lock del jugador antes de abrir la
  // transacción; la solicitud se relee adentro, que es donde cuenta.
  const { rows: pre } = await pool.query(
    'SELECT member_id FROM membership_requests WHERE id = $1',
    [input.requestId]
  );
  if (!pre[0]) throw new MembershipError(404, 'Solicitud no encontrada');

  return withMembersLock([pre[0].member_id as string], async (client, members) => {
    const member = members[0];
    const row = await lockPendingRequest(client, input.requestId);

    const requestedKind = row.kind as RequestKind;
    const kind = overrideKind ?? requestedKind;
    const from = overrideFrom ?? toDateString(row.effective_from as Date);
    // Un override de tipo descarta el `effective_until` del pedido original si el
    // tipo final no lo admite; si el admin convierte una baja en suspensión, la
    // fecha de fin tiene que venir de él.
    const until = hasOverrideUntil
      ? overrideUntil
      : kind === requestedKind && row.effective_until
        ? toDateString(row.effective_until as Date)
        : null;
    if (until && kind !== 'SUSPENSION') {
      throw new MembershipError(
        400,
        'La fecha de finalización sólo se aplica a una suspensión'
      );
    }

    // Acá vive TODA la lógica de transición: validación del estado, cierre del
    // período vigente, liberación de cochera y auditoría del jugador.
    let periodId: string | null = null;
    if (kind === 'SUSPENSION') {
      const period = await suspendTx(client, member, {
        effectiveFrom: from,
        effectiveUntil: until,
        reason: row.reason as string,
        actorId: input.actorId,
      });
      periodId = period.id;
    } else if (kind === 'TERMINATION') {
      const period = await terminateTx(client, member, {
        effectiveFrom: from,
        reason: row.reason as string,
        actorId: input.actorId,
      });
      periodId = period.id;
    } else {
      // Una reactivación CIERRA el período vigente en vez de crear uno nuevo, así
      // que no hay período propio al que apuntar: period_id queda en NULL a
      // propósito. El período cerrado ya queda trazado en la auditoría del
      // jugador (`reactivated`, campo closed_period_id).
      await reactivateTx(client, member, {
        effectiveFrom: from,
        reason: note,
        actorId: input.actorId,
      });
    }

    const { rows } = await client.query(
      `UPDATE membership_requests
       SET status = 'APPROVED', resolved_at = NOW(), resolved_by = $2,
           resolution_note = $3, period_id = $4
       WHERE id = $1
       RETURNING *`,
      [input.requestId, input.actorId, note, periodId]
    );

    // Auditoría propia de la solicitud: es lo que permite demostrar después que
    // el administrador modificó el pedido antes de aprobarlo.
    await audit(client, {
      entity: 'membership_request',
      entityId: input.requestId,
      action: 'approved',
      oldValue: {
        kind: requestedKind,
        effective_from: toDateString(row.effective_from as Date),
        effective_until: row.effective_until ? toDateString(row.effective_until as Date) : null,
      },
      newValue: {
        kind,
        requested_kind: requestedKind,
        modified: kind !== requestedKind || overrideFrom !== null || hasOverrideUntil,
        effective_from: from,
        effective_until: until,
        member_id: member.id,
        period_id: periodId,
      },
      actorId: input.actorId,
      reason: note,
    });

    return { request: mapRow(rows[0]), applied_kind: kind, period_id: periodId };
  });
}

/** Rechazar no toca el estado del jugador: sólo cierra el pedido con su motivo. */
export async function rejectRequest(input: {
  requestId: string;
  actorId: string;
  note: unknown;
}): Promise<MembershipRequest> {
  const note = assertReason(input.note, true)!;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const row = await lockPendingRequest(client, input.requestId);
    const { rows } = await client.query(
      `UPDATE membership_requests
       SET status = 'REJECTED', resolved_at = NOW(), resolved_by = $2, resolution_note = $3
       WHERE id = $1
       RETURNING *`,
      [input.requestId, input.actorId, note]
    );
    await audit(client, {
      entity: 'membership_request',
      entityId: input.requestId,
      action: 'rejected',
      oldValue: { kind: row.kind, status: 'PENDING' },
      newValue: { status: 'REJECTED', member_id: row.member_id },
      actorId: input.actorId,
      reason: note,
    });
    await client.query('COMMIT');
    return mapRow(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
