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

/**
 * GET /api/admin/analytics/members/:id
 * Query: from (YYYY-MM-DD), to (YYYY-MM-DD)
 */
router.get('/members/:id', async (req: Request, res: Response) => {
  const range = parseDateRange(req);
  if (!range) { res.status(400).json({ error: 'from y to requeridos' }); return; }
  const { from, to } = range;
  const memberId = req.params.id;

  const dateExpr = CHECKED_IN_DATE_AR;

  const memberRes = await pool.query(
    `SELECT m.id, m.nombre, m.apellido, m.activo, m.categoria_id,
            c.nombre AS categoria_nombre
     FROM members m LEFT JOIN categorias c ON c.id = m.categoria_id
     WHERE m.id = $1`,
    [memberId]
  );
  if (!memberRes.rows[0]) { res.status(404).json({ error: 'Jugador no encontrado' }); return; }
  const member = memberRes.rows[0];

  const [statsRes, historyRes, schedulesRes] = await Promise.all([
    pool.query(
      `SELECT COUNT(*) AS total,
              ROUND(AVG(EXTRACT(HOUR FROM (checked_in_at - INTERVAL '3 hours')) +
                        EXTRACT(MINUTE FROM (checked_in_at - INTERVAL '3 hours')) / 60.0)::numeric, 2) AS avg_hour,
              MAX(${dateExpr}) AS last_checkin
       FROM check_ins
       WHERE member_id = $1 AND ${dateExpr} BETWEEN $2 AND $3`,
      [memberId, from, to]
    ),
    pool.query(
      `SELECT ${dateExpr} AS date,
              checked_in_at,
              EXTRACT(HOUR FROM (checked_in_at - INTERVAL '3 hours')) +
              EXTRACT(MINUTE FROM (checked_in_at - INTERVAL '3 hours')) / 60.0 AS hour_decimal,
              (EXTRACT(ISODOW FROM (checked_in_at - INTERVAL '3 hours'))::int - 1) AS weekday
       FROM check_ins
       WHERE member_id = $1 AND ${dateExpr} BETWEEN $2 AND $3
       ORDER BY checked_in_at DESC LIMIT 60`,
      [memberId, from, to]
    ),
    member.categoria_id ? pool.query(
      `SELECT day_of_week, start_time, tolerance_min, valid_from, valid_until
       FROM training_schedules
       WHERE categoria_id = $1
       ORDER BY day_of_week, valid_from`,
      [member.categoria_id]
    ) : Promise.resolve({ rows: [] as Array<{day_of_week: number; start_time: string; tolerance_min: number; valid_from: string; valid_until: string | null}> }),
  ]);

  const schedules = schedulesRes.rows as Array<{day_of_week: number; start_time: string; tolerance_min: number; valid_from: string; valid_until: string | null}>;

  const history = historyRes.rows.map((row: {date: string; checked_in_at: Date; hour_decimal: number; weekday: number}) => {
    const checkinDate = new Date(row.date);
    const sched = schedules.find(s =>
      s.day_of_week === Number(row.weekday) &&
      new Date(s.valid_from) <= checkinDate &&
      (s.valid_until == null || new Date(s.valid_until) > checkinDate)
    );
    let schedule_match: string | null = null;
    if (sched) {
      const [h, m] = (sched.start_time as string).split(':').map(Number);
      const scheduledHour = h + m / 60;
      const diff = (Number(row.hour_decimal) - scheduledHour) * 60;
      if (diff < 0) schedule_match = 'early';
      else if (diff <= sched.tolerance_min) schedule_match = 'on_time';
      else schedule_match = 'late';
    } else if (schedules.length === 0) {
      schedule_match = null;
    } else {
      schedule_match = 'unscheduled';
    }
    return {
      date: row.date,
      hour_decimal: parseFloat(Number(row.hour_decimal).toFixed(2)),
      schedule_match,
    };
  });

  let sessions_expected = 0;
  let attendance_pct: number | null = null;
  if (schedules.length > 0 && member.categoria_id) {
    const fromDate = new Date(from);
    const toDate   = new Date(to);
    for (let d = new Date(fromDate); d <= toDate; d.setDate(d.getDate() + 1)) {
      const dow = (d.getDay() + 6) % 7;
      const hasSchedule = schedules.some(s =>
        s.day_of_week === dow &&
        new Date(s.valid_from) <= d &&
        (s.valid_until == null || new Date(s.valid_until) > d)
      );
      if (hasSchedule) sessions_expected++;
    }
    const total = parseInt(statsRes.rows[0].total);
    attendance_pct = sessions_expected > 0 ? Math.round((total / sessions_expected) * 100) : null;
  }

  const lastCheckin = statsRes.rows[0].last_checkin;
  const daysSinceLast = lastCheckin
    ? Math.floor((Date.now() - new Date(lastCheckin).getTime()) / 86400000)
    : null;

  res.json({
    member,
    total_checkins: parseInt(statsRes.rows[0].total),
    avg_hour: statsRes.rows[0].avg_hour ? parseFloat(statsRes.rows[0].avg_hour) : null,
    sessions_expected,
    attendance_pct,
    days_since_last: daysSinceLast,
    history,
  });
});

/**
 * GET /api/admin/analytics/insights
 * Query: from (YYYY-MM-DD), to (YYYY-MM-DD)
 */
router.get('/insights', async (req: Request, res: Response) => {
  const range = parseDateRange(req);
  if (!range) { res.status(400).json({ error: 'from y to requeridos' }); return; }
  const { from, to } = range;
  const dateExpr = CHECKED_IN_DATE_AR;
  const insights: Array<{type: string; severity: string; message: string; data?: unknown}> = [];

  // Insight 1: active members with history but no check-in in the period
  const inactiveRes = await pool.query(
    `SELECT m.nombre, m.apellido, MAX(${dateExpr}) AS last_checkin, COUNT(c.id) AS total_hist
     FROM members m
     LEFT JOIN check_ins c ON c.member_id = m.id
     WHERE m.activo = true
     GROUP BY m.id, m.nombre, m.apellido
     HAVING MAX(CASE WHEN ${dateExpr} BETWEEN $1 AND $2 THEN 1 ELSE 0 END) = 0
       AND COUNT(c.id) > 0
     ORDER BY last_checkin ASC NULLS LAST
     LIMIT 5`,
    [from, to]
  );
  if (inactiveRes.rows.length > 0) {
    insights.push({
      type: 'inactive_members',
      severity: inactiveRes.rows.length >= 3 ? 'warning' : 'info',
      message: `${inactiveRes.rows.length} jugador${inactiveRes.rows.length > 1 ? 'es' : ''} sin actividad en el período.`,
      data: inactiveRes.rows.map(r => `${r.nombre} ${r.apellido}`),
    });
  }

  // Insight 2: peak hour and day
  const peakRes = await pool.query(
    `SELECT (EXTRACT(ISODOW FROM (checked_in_at - INTERVAL '3 hours'))::int - 1) AS weekday,
            EXTRACT(HOUR FROM (checked_in_at - INTERVAL '3 hours'))::int AS hour,
            COUNT(*) AS count
     FROM check_ins c JOIN members m ON m.id = c.member_id
     WHERE ${dateExpr} BETWEEN $1 AND $2 AND m.activo = true
     GROUP BY 1, 2 ORDER BY count DESC LIMIT 1`,
    [from, to]
  );
  if (peakRes.rows[0] && parseInt(peakRes.rows[0].count) > 2) {
    const days = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
    const { weekday, hour, count } = peakRes.rows[0];
    insights.push({
      type: 'peak_traffic',
      severity: 'info',
      message: `Hora pico: ${days[weekday]} a las ${hour}:00 hs con ${count} ingresos.`,
      data: { weekday, hour, count: parseInt(count) },
    });
  }

  // Insight 3: categories with no activity in period
  const inactiveCats = await pool.query(
    `SELECT c.nombre FROM categorias c
     WHERE NOT EXISTS (
       SELECT 1 FROM check_ins ci JOIN members m ON m.id = ci.member_id
       WHERE m.categoria_id = c.id AND ${dateExpr} BETWEEN $1 AND $2
     )
     AND EXISTS (SELECT 1 FROM members m2 WHERE m2.categoria_id = c.id AND m2.activo = true)`,
    [from, to]
  );
  if (inactiveCats.rows.length > 0) {
    insights.push({
      type: 'inactive_categories',
      severity: 'info',
      message: `${inactiveCats.rows.map((r: {nombre: string}) => r.nombre).join(', ')} sin registros en el período.`,
      data: inactiveCats.rows.map((r: {nombre: string}) => r.nombre),
    });
  }

  res.json(insights);
});

export default router;
