import { Router } from 'express';
import { pool } from '../db';
import { authMiddleware, requireRole } from '../middleware/auth';
import { CHECKED_IN_DATE_AR } from '../utils/time';

const router = Router();
router.use(authMiddleware, requireRole('admin'));

/** Días sin registrar ingreso a partir de los cuales se considera que alguien se descolgó. */
const DIAS_DESCOLGADO = 21;
/** Días sin actividad a partir de los cuales una categoría pasa a "atención". */
const DIAS_CATEGORIA_TIBIA = 7;

/**
 * Contadores del Inicio en una sola llamada. Son conteos sobre tablas chicas
 * (cientos de filas); si el club creciera, acá es donde hay que medir.
 */
router.get('/dashboard', async (_req, res) => {
  const [pendientes, club, categorias] = await Promise.all([
    pool.query(
      `SELECT
         (SELECT COUNT(*) FROM (
            SELECT m.id FROM members m
            JOIN member_membership_state s ON s.member_id = m.id AND s.status = 'ACTIVE'
            JOIN check_ins ci ON ci.member_id = m.id
            GROUP BY m.id
            HAVING MAX(ci.checked_in_at) < NOW() - ($1::int * INTERVAL '1 day')
          ) q) AS descolgados,
         (SELECT COUNT(*) FROM member_membership_state WHERE needs_review) AS a_revisar,
         (SELECT COUNT(*) FROM members m
            JOIN member_membership_state s ON s.member_id = m.id AND s.status = 'ACTIVE'
            WHERE m.foto_url IS NULL) AS sin_foto,
         (SELECT COUNT(*) FROM training_schedules WHERE valid_until IS NULL) AS horarios`,
      [DIAS_DESCOLGADO]
    ),
    pool.query(
      `SELECT
         (SELECT COUNT(*) FROM member_membership_state WHERE status = 'ACTIVE') AS activos,
         (SELECT COUNT(*) FROM member_membership_state WHERE status = 'SUSPENDED') AS suspendidos,
         (SELECT COUNT(*) FROM member_membership_state WHERE status = 'TERMINATED') AS bajas,
         (SELECT COUNT(*) FROM check_ins WHERE checked_in_at > NOW() - INTERVAL '7 days') AS ingresos_7d,
         (SELECT COUNT(DISTINCT member_id) FROM check_ins
            WHERE checked_in_at > NOW() - INTERVAL '7 days') AS jugadores_7d`
    ),
    pool.query(
      `WITH cat AS (
         SELECT c.id, c.nombre,
                COUNT(DISTINCT m.id) AS activos,
                MAX(${CHECKED_IN_DATE_AR}) AS ultimo_ingreso,
                CASE
                  WHEN COALESCE(MAX(ci.checked_in_at), '-infinity'::timestamp)
                       < NOW() - ($1::int * INTERVAL '1 day') THEN 'alert'
                  WHEN COALESCE(MAX(ci.checked_in_at), '-infinity'::timestamp)
                       < NOW() - ($2::int * INTERVAL '1 day') THEN 'warn'
                  ELSE 'ok'
                END AS estado
         FROM categorias c
         JOIN members m ON m.categoria_id = c.id
         JOIN member_membership_state s ON s.member_id = m.id AND s.status = 'ACTIVE'
         LEFT JOIN check_ins ci ON ci.member_id = m.id
         GROUP BY c.id, c.nombre
       )
       SELECT * FROM cat
       ORDER BY CASE estado WHEN 'alert' THEN 0 WHEN 'warn' THEN 1 ELSE 2 END, nombre`,
      [DIAS_DESCOLGADO, DIAS_CATEGORIA_TIBIA]
    ),
  ]);

  const p = pendientes.rows[0];
  const c = club.rows[0];
  const n = (v: string) => parseInt(v, 10);

  res.json({
    pendientes: {
      descolgados: n(p.descolgados),
      a_revisar: n(p.a_revisar),
      sin_foto: n(p.sin_foto),
      horarios: n(p.horarios),
    },
    club: {
      activos: n(c.activos),
      suspendidos: n(c.suspendidos),
      bajas: n(c.bajas),
      ingresos_7d: n(c.ingresos_7d),
      jugadores_7d: n(c.jugadores_7d),
    },
    categorias: categorias.rows.map(r => ({
      id: r.id,
      nombre: r.nombre,
      activos: n(r.activos),
      ultimo_ingreso: r.ultimo_ingreso
        ? new Date(r.ultimo_ingreso).toISOString().slice(0, 10)
        : null,
      estado: r.estado as 'ok' | 'warn' | 'alert',
    })),
  });
});

export default router;
