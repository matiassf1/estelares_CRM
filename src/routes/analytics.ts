import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { authMiddleware, requireRole } from '../middleware/auth';
import { CHECKED_IN_DATE_AR } from '../utils/time';

const router = Router();
router.use(authMiddleware, requireRole('admin'));

function parseDateRange(req: Request): { from: string; to: string } | null {
  const from = req.query.from as string;
  const to   = req.query.to   as string;
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return null;
  return { from, to };
}

/**
 * GET /api/admin/analytics/overview
 * Query: from (YYYY-MM-DD), to (YYYY-MM-DD), categoryId? (number)
 */
router.get('/overview', async (req: Request, res: Response) => {
  const range = parseDateRange(req);
  if (!range) {
    res.status(400).json({ error: 'from y to requeridos (YYYY-MM-DD)' });
    return;
  }
  const { from, to } = range;
  const categoryId = req.query.categoryId ? Number(req.query.categoryId) : null;

  const days = Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1;
  const prevTo   = new Date(new Date(from).getTime() - 86400000).toISOString().slice(0, 10);
  const prevFrom = new Date(new Date(from).getTime() - days * 86400000).toISOString().slice(0, 10);

  const dateExpr = CHECKED_IN_DATE_AR;

  // Build params arrays: base [from, to], extended [from, to, categoryId] when filter active
  const baseParams = [from, to];
  const catParams  = categoryId != null ? [from, to, categoryId] : [from, to];
  const catClause  = categoryId != null ? 'AND m.categoria_id = $3' : '';

  const [mainStats, prevStats, byDay, topMembers, activeCats] = await Promise.all([
    pool.query(
      `SELECT COUNT(c.id) AS total_checkins,
              COUNT(DISTINCT c.member_id) AS unique_members
       FROM check_ins c
       JOIN members m ON m.id = c.member_id
       WHERE ${dateExpr} BETWEEN $1 AND $2
         AND m.activo = true ${catClause}`,
      catParams
    ),
    pool.query(
      `SELECT COUNT(c.id) AS total_checkins
       FROM check_ins c
       JOIN members m ON m.id = c.member_id
       WHERE ${dateExpr} BETWEEN $1 AND $2
         AND m.activo = true ${catClause}`,
      categoryId != null ? [prevFrom, prevTo, categoryId] : [prevFrom, prevTo]
    ),
    pool.query(
      `SELECT ${dateExpr} AS date, COUNT(*) AS count
       FROM check_ins c
       JOIN members m ON m.id = c.member_id
       WHERE ${dateExpr} BETWEEN $1 AND $2
         AND m.activo = true ${catClause}
       GROUP BY 1 ORDER BY 1`,
      catParams
    ),
    pool.query(
      `SELECT m.id, m.nombre, m.apellido, COUNT(c.id) AS count
       FROM check_ins c
       JOIN members m ON m.id = c.member_id
       WHERE ${dateExpr} BETWEEN $1 AND $2
         AND m.activo = true ${catClause}
       GROUP BY m.id, m.nombre, m.apellido
       ORDER BY count DESC LIMIT 10`,
      catParams
    ),
    pool.query(
      `SELECT cat.id, cat.nombre, COUNT(c.id) AS count
       FROM check_ins c
       JOIN members m ON m.id = c.member_id
       JOIN categorias cat ON cat.id = m.categoria_id
       WHERE ${dateExpr} BETWEEN $1 AND $2
         AND m.activo = true
       GROUP BY cat.id, cat.nombre
       ORDER BY count DESC`,
      baseParams
    ),
  ]);

  const activeMembersParams = categoryId != null ? [categoryId] : [];
  const activeMembersClause = categoryId != null ? 'AND categoria_id = $1' : '';
  const activeMembersCount = (await pool.query(
    `SELECT COUNT(*) AS count FROM members WHERE activo = true ${activeMembersClause}`,
    activeMembersParams
  )).rows[0].count;

  const inactiveRes = await pool.query(
    `SELECT m.id, m.nombre, m.apellido,
            MAX(${dateExpr}) AS last_checkin
     FROM members m
     LEFT JOIN check_ins c ON c.member_id = m.id
     WHERE m.activo = true ${catClause}
       AND m.id NOT IN (
         SELECT DISTINCT c2.member_id FROM check_ins c2
         JOIN members m2 ON m2.id = c2.member_id
         WHERE ${dateExpr} BETWEEN $1 AND $2 AND m2.activo = true ${catClause}
       )
     GROUP BY m.id, m.nombre, m.apellido
     ORDER BY last_checkin DESC NULLS LAST
     LIMIT 20`,
    catParams
  );

  const total = parseInt(mainStats.rows[0].total_checkins);
  const prevTotal = parseInt(prevStats.rows[0].total_checkins);

  res.json({
    total_checkins: total,
    unique_members: parseInt(mainStats.rows[0].unique_members),
    active_members: parseInt(activeMembersCount),
    checkins_prev_period: prevTotal,
    trend_pct: prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null,
    avg_daily: byDay.rows.length > 0
      ? Math.round((total / byDay.rows.length) * 10) / 10
      : 0,
    by_day: byDay.rows.map(r => ({ date: r.date, count: parseInt(r.count) })),
    top_members: topMembers.rows.map(r => ({ ...r, count: parseInt(r.count) })),
    inactive_members: inactiveRes.rows,
    active_categories: activeCats.rows.map(r => ({ ...r, count: parseInt(r.count) })),
  });
});

/**
 * GET /api/admin/analytics/categories/:id
 * Query: from (YYYY-MM-DD), to (YYYY-MM-DD)
 */
router.get('/categories/:id', async (req: Request, res: Response) => {
  const range = parseDateRange(req);
  if (!range) { res.status(400).json({ error: 'from y to requeridos' }); return; }
  const { from, to } = range;
  const catId = parseInt(req.params.id);
  if (isNaN(catId)) { res.status(400).json({ error: 'id inválido' }); return; }

  const dateExpr = CHECKED_IN_DATE_AR;

  const [catRes, statsRes, byDay, membersRes, schedulesRes] = await Promise.all([
    pool.query(`SELECT id, nombre FROM categorias WHERE id = $1`, [catId]),
    pool.query(
      `SELECT COUNT(c.id) AS total_checkins,
              COUNT(DISTINCT c.member_id) AS unique_members
       FROM check_ins c JOIN members m ON m.id = c.member_id
       WHERE m.categoria_id = $1 AND ${dateExpr} BETWEEN $2 AND $3 AND m.activo = true`,
      [catId, from, to]
    ),
    pool.query(
      `SELECT ${dateExpr} AS date, COUNT(*) AS count
       FROM check_ins c JOIN members m ON m.id = c.member_id
       WHERE m.categoria_id = $1 AND ${dateExpr} BETWEEN $2 AND $3 AND m.activo = true
       GROUP BY 1 ORDER BY 1`,
      [catId, from, to]
    ),
    pool.query(
      `SELECT m.id, m.nombre, m.apellido,
              COUNT(c.id) AS count,
              ROUND(AVG(EXTRACT(HOUR FROM (c.checked_in_at - INTERVAL '3 hours')) +
                        EXTRACT(MINUTE FROM (c.checked_in_at - INTERVAL '3 hours')) / 60.0)::numeric, 2) AS avg_hour,
              MAX(${dateExpr}) AS last_checkin
       FROM members m
       LEFT JOIN check_ins c ON c.member_id = m.id
         AND ${dateExpr} BETWEEN $2 AND $3
       WHERE m.categoria_id = $1 AND m.activo = true
       GROUP BY m.id, m.nombre, m.apellido
       ORDER BY count DESC, m.apellido`,
      [catId, from, to]
    ),
    pool.query(
      `SELECT id, day_of_week, start_time, tolerance_min, valid_from, valid_until
       FROM training_schedules
       WHERE categoria_id = $1 AND valid_until IS NULL
       ORDER BY day_of_week, start_time`,
      [catId]
    ),
  ]);

  if (!catRes.rows[0]) { res.status(404).json({ error: 'Categoría no encontrada' }); return; }

  const activeMembersInCat = (await pool.query(
    `SELECT COUNT(*) AS count FROM members WHERE categoria_id = $1 AND activo = true`,
    [catId]
  )).rows[0].count;

  res.json({
    categoria: catRes.rows[0],
    total_checkins: parseInt(statsRes.rows[0].total_checkins),
    unique_members: parseInt(statsRes.rows[0].unique_members),
    active_members: parseInt(activeMembersInCat),
    by_day: byDay.rows.map(r => ({ date: r.date, count: parseInt(r.count) })),
    members: membersRes.rows.map(r => ({
      ...r,
      count: parseInt(r.count),
      avg_hour: r.avg_hour ? parseFloat(r.avg_hour) : null,
    })),
    schedules: schedulesRes.rows,
  });
});

/**
 * GET /api/admin/analytics/traffic
 * Query: from (YYYY-MM-DD), to (YYYY-MM-DD), categoryId? (number)
 */
router.get('/traffic', async (req: Request, res: Response) => {
  const range = parseDateRange(req);
  if (!range) { res.status(400).json({ error: 'from y to requeridos' }); return; }
  const { from, to } = range;
  const categoryId = req.query.categoryId ? Number(req.query.categoryId) : null;

  const dateExpr = CHECKED_IN_DATE_AR;
  const catClause = categoryId != null ? 'AND m.categoria_id = $3' : '';
  const catParams = categoryId != null ? [from, to, categoryId] : [from, to];

  const [byHour, byWeekday, heatmap] = await Promise.all([
    pool.query(
      `SELECT EXTRACT(HOUR FROM (checked_in_at - INTERVAL '3 hours'))::int AS hour,
              COUNT(*) AS count
       FROM check_ins c JOIN members m ON m.id = c.member_id
       WHERE ${dateExpr} BETWEEN $1 AND $2 AND m.activo = true ${catClause}
       GROUP BY 1 ORDER BY 1`,
      catParams
    ),
    pool.query(
      `SELECT (EXTRACT(ISODOW FROM (checked_in_at - INTERVAL '3 hours'))::int - 1) AS weekday,
              COUNT(*) AS count
       FROM check_ins c JOIN members m ON m.id = c.member_id
       WHERE ${dateExpr} BETWEEN $1 AND $2 AND m.activo = true ${catClause}
       GROUP BY 1 ORDER BY 1`,
      catParams
    ),
    pool.query(
      `SELECT (EXTRACT(ISODOW FROM (checked_in_at - INTERVAL '3 hours'))::int - 1) AS weekday,
              EXTRACT(HOUR FROM (checked_in_at - INTERVAL '3 hours'))::int AS hour,
              COUNT(*) AS count
       FROM check_ins c JOIN members m ON m.id = c.member_id
       WHERE ${dateExpr} BETWEEN $1 AND $2 AND m.activo = true ${catClause}
       GROUP BY 1, 2 ORDER BY 1, 2`,
      catParams
    ),
  ]);

  res.json({
    by_hour: byHour.rows.map(r => ({ hour: r.hour, count: parseInt(r.count) })),
    by_weekday: byWeekday.rows.map(r => ({ weekday: r.weekday, count: parseInt(r.count) })),
    heatmap: heatmap.rows.map(r => ({ weekday: r.weekday, hour: r.hour, count: parseInt(r.count) })),
  });
});

export default router;
