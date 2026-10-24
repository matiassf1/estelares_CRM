-- Membresía administrativa del club: suspensiones, bajas y reactivaciones.
-- Migración: 004_membership_periods
--
-- Aditiva. No modifica datos existentes ni toca members / check_ins.
-- Reversión: DROP VIEW member_membership_state; DROP TABLE membership_periods;
--            (members.activo queda intacto, por lo que revertir el código basta)
--
-- MODELO
-- ------
-- La fuente de verdad es `membership_periods`: hechos administrativos con fecha.
-- El estado actual NO se almacena, se deriva en la vista `member_membership_state`
-- a partir de los períodos y la fecha de hoy. Esto resuelve sin ningún proceso
-- programado las suspensiones futuras (empiezan solas) y las que tienen fecha de
-- fin (terminan solas), y hace estructuralmente imposible que el estado quede
-- desincronizado: no hay dos representaciones del mismo hecho.
--
-- SEMÁNTICA DE INTERVALOS
-- -----------------------
-- Tipo DATE, calendario argentino, nunca timestamp.
-- Intervalo SEMIABIERTO [effective_from, effective_until):
--   from=2026-03-10, until=2026-05-10  =>  suspendido del 10/03 al 09/05 inclusive;
--                                          el 10/05 ya está activo.
-- "Hoy" se evalúa siempre como CAST((NOW() - INTERVAL '3 hours') AS DATE), el mismo
-- offset fijo que usan uniq_member_checkin_day (db.ts) y CHECKED_IN_DATE_AR
-- (utils/time.ts). NO usar CURRENT_DATE: el servidor corre en UTC y entre las 21:00
-- y las 00:00 ART devolvería el día siguiente.
--
-- Una reactivación NO es un período: es el cierre de uno (closed_at + effective_until).
-- Un período abierto significa "restricción vigente"; su ausencia significa activo.
-- Un estado = una fila. No hay forma de expresar una contradicción.

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS membership_periods (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       UUID NOT NULL REFERENCES members(id),
  kind            VARCHAR(20) NOT NULL CHECK (kind IN ('SUSPENSION','TERMINATION')),
  effective_from  DATE NOT NULL,
  effective_until DATE,
  reason          TEXT NOT NULL,
  created_by      UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at       TIMESTAMPTZ,
  closed_by       UUID,
  close_reason    TEXT,
  cancelled_at    TIMESTAMPTZ,
  legacy_migrated BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT membership_period_range CHECK (effective_until IS NULL OR effective_until > effective_from)
);

-- Impide solapamientos a nivel base: suspensiones superpuestas, dos bajas
-- concurrentes, o una baja encima de una suspensión vigente.
-- Bajo '[)' dos períodos consecutivos (until de uno == from del siguiente) NO
-- solapan, que es exactamente el comportamiento deseado.
DO $$
BEGIN
  ALTER TABLE membership_periods ADD CONSTRAINT membership_periods_no_overlap
    EXCLUDE USING gist (
      member_id WITH =,
      daterange(effective_from, effective_until, '[)') WITH &&
    ) WHERE (cancelled_at IS NULL);
EXCEPTION
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_membership_periods_member
  ON membership_periods (member_id, effective_from DESC)
  WHERE cancelled_at IS NULL;

-- Estado administrativo vigente de cada jugador. 'ACTIVE' cuando no hay ningún
-- período restrictivo cubriendo el día de hoy.
CREATE OR REPLACE VIEW member_membership_state AS
SELECT m.id                        AS member_id,
       COALESCE(p.status, 'ACTIVE') AS status,
       p.effective_from            AS status_since,
       p.effective_until           AS status_until,
       p.reason                    AS status_reason,
       p.id                        AS period_id,
       COALESCE(p.legacy_migrated, false) AS needs_review
FROM members m
LEFT JOIN LATERAL (
  SELECT mp.id,
         CASE mp.kind WHEN 'TERMINATION' THEN 'TERMINATED' ELSE 'SUSPENDED' END AS status,
         mp.effective_from, mp.effective_until, mp.reason, mp.legacy_migrated
  FROM membership_periods mp
  WHERE mp.member_id = m.id
    AND mp.cancelled_at IS NULL
    AND mp.effective_from <= CAST((NOW() - INTERVAL '3 hours') AS DATE)
    AND (mp.effective_until IS NULL
         OR mp.effective_until > CAST((NOW() - INTERVAL '3 hours') AS DATE))
  ORDER BY (mp.kind = 'TERMINATION') DESC, mp.effective_from DESC
  LIMIT 1
) p ON true;

-- BACKFILL ATÓMICO
-- ----------------
-- Va DENTRO de la migración, no en un script aparte, porque el runner ejecuta el
-- archivo completo en una única transacción implícita. Si el backfill fuera
-- manual y posterior, entre el deploy y su ejecución la vista devolvería ACTIVE
-- para TODOS: los jugadores hoy desactivados podrían iniciar sesión y, peor,
-- registrar ingreso al club. Esa ventana no es aceptable.
--
-- Se migran como SUSPENSION, nunca como TERMINATION: el motivo real de esas
-- desactivaciones no quedó registrado en ningún lado, y clasificarlas como baja
-- sería inventar un hecho administrativo que no ocurrió. La suspensión es
-- reversible, preserva exactamente el comportamiento actual (sin ingreso, fuera
-- del padrón activo) y queda marcada con legacy_migrated para que el club la
-- reclasifique desde el chip "Revisar" del panel.
INSERT INTO membership_periods
  (member_id, kind, effective_from, effective_until, reason, created_by, legacy_migrated)
SELECT m.id,
       'SUSPENSION',
       CAST((NOW() - INTERVAL '3 hours') AS DATE),
       NULL,
       'Estado migrado automáticamente desde el sistema anterior. El motivo original no fue registrado. Requiere revisión administrativa.',
       (SELECT a.id FROM admins a ORDER BY a.created_at LIMIT 1),
       true
FROM members m
WHERE m.activo = false
  AND EXISTS (SELECT 1 FROM admins)   -- created_by es NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM membership_periods mp
    WHERE mp.member_id = m.id AND mp.cancelled_at IS NULL
  );

-- audit_log ya existe (001). Se reutiliza para el club: no tiene ninguna FK, por
-- lo que no acopla ambos sistemas. El discriminador evita la ambigüedad de
-- performed_by (admins.id en la base del club, association_operators.id en la de
-- la asociación) si alguna vez conviven en una misma base.
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS performed_by_type VARCHAR(20);
