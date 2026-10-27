-- Solicitudes de membresía iniciadas por el jugador.
-- Migración: 006_membership_requests
--
-- Aditiva. No toca members, membership_periods ni la vista member_membership_state.
-- Reversión: DROP TABLE membership_requests; (nada más depende de ella)
--
-- POR QUÉ EXISTE
-- --------------
-- El club necesita que interrumpir la membresía sea un pedido formal: hasta ahora
-- sólo el administrador podía suspender o dar de baja, y los jugadores que dejaban
-- de venir discutían después las cuotas generadas durante su ausencia.
--
-- UNA SOLICITUD NO ES UN HECHO ADMINISTRATIVO
-- -------------------------------------------
-- Esta tabla es deliberadamente independiente de membership_periods, que sigue
-- siendo la ÚNICA fuente de verdad del estado. Una fila acá no cambia el estado
-- del jugador: es una intención registrada con fecha, y esa fecha es la prueba de
-- cuándo avisó. Si una solicitud se aplicara sola, cualquiera se autosuspendería
-- el día 28 y el club volvería al problema que este módulo viene a resolver.
--
-- El puente entre ambos mundos es `period_id`, que se completa recién al aprobar:
-- une el pedido con el hecho que produjo. Queda NULL cuando la aprobación no crea
-- un período —una REACTIVATION cierra el período vigente en vez de abrir uno
-- nuevo— y también, obviamente, en las rechazadas y canceladas.

CREATE TABLE IF NOT EXISTS membership_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       UUID NOT NULL REFERENCES members(id),
  kind            VARCHAR(20) NOT NULL
                  CHECK (kind IN ('SUSPENSION','TERMINATION','REACTIVATION')),
  -- La fecha que pide el jugador. Es un pedido, no un rango vigente: por eso acá
  -- no hay constraint EXCLUDE como en membership_periods. Dos pedidos con fechas
  -- solapadas no son una contradicción, porque ninguno tiene efecto por sí mismo.
  effective_from  DATE NOT NULL,
  effective_until DATE,
  reason          TEXT NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                  CHECK (status IN ('PENDING','APPROVED','REJECTED','CANCELLED')),
  requested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID,                 -- admins.id; sin FK, igual que membership_periods.created_by
  resolution_note TEXT,
  period_id       UUID REFERENCES membership_periods(id),
  -- effective_until sólo tiene sentido en una suspensión: una baja no tiene fecha
  -- de fin y una reactivación es un instante, no un rango.
  CONSTRAINT membership_requests_until_only_suspension
    CHECK (effective_until IS NULL OR kind = 'SUSPENSION'),
  CONSTRAINT membership_requests_range
    CHECK (effective_until IS NULL OR effective_until > effective_from)
);

-- Una sola solicitud pendiente por jugador, garantizado por la base. El servicio
-- valida antes para dar un mensaje legible; esto es la red de último recurso ante
-- dos envíos simultáneos desde el portal (doble clic, pestaña duplicada).
-- Parcial a propósito: el historial de resueltas puede tener tantas filas como
-- haga falta, y ésas son justamente las que prueban el recorrido del jugador.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_membership_request_pending
  ON membership_requests (member_id)
  WHERE status = 'PENDING';

-- La bandeja del administrador filtra por estado y ordena por antigüedad del
-- pedido: la solicitud más vieja sin resolver es la que más urge.
CREATE INDEX IF NOT EXISTS idx_membership_requests_status
  ON membership_requests (status, requested_at DESC);
