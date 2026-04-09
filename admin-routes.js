// admin-routes.js — Admin API router for ReliableAI
'use strict';

const express = require('express');
const { requireSuperAdmin, auditLog } = require('./admin-middleware');

module.exports = function createAdminRouter(db, PLANS, PRICING, stripe) {
  const router = express.Router();

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function syncModelConfig() {
    const upsert = db.prepare(`
      INSERT INTO model_config (model_id, provider, price_input, price_output)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(model_id) DO UPDATE SET
        provider = excluded.provider,
        price_input = excluded.price_input,
        price_output = excluded.price_output,
        updated_at = CURRENT_TIMESTAMP
    `);
    // Build provider map from PRICING keys vs known provider prefixes
    const providerMap = {
      'claude': 'anthropic', 'gpt': 'openai', 'o3': 'openai', 'o4': 'openai',
      'gemini': 'google', 'models/gemini': 'google', 'grok': 'xai', 'sonar': 'perplexity',
      'moonshot': 'kimi', 'qwen': 'qwen', 'qwq': 'qwen',
    };
    for (const [modelId, price] of Object.entries(PRICING)) {
      const provider = Object.entries(providerMap).find(([k]) => modelId.startsWith(k))?.[1] || 'unknown';
      upsert.run(modelId, provider, price.input ?? 0, price.output ?? 0);
    }
  }

  function safeGet(query, params = []) {
    try { return db.prepare(query).get(...params); } catch { return null; }
  }
  function safeAll(query, params = []) {
    try { return db.prepare(query).all(...params); } catch { return []; }
  }

  // ── Dashboard / KPIs ────────────────────────────────────────────────────────

  router.get('/dashboard/kpis', (req, res) => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const weekAgo = new Date(now - 7 * 864e5).toISOString().slice(0, 10);
    const monthAgo = new Date(now - 30 * 864e5).toISOString().slice(0, 10);

    const totalUsers      = safeGet('SELECT COUNT(*) as n FROM users')?.n ?? 0;
    const activeToday     = safeGet('SELECT COUNT(DISTINCT user_id) as n FROM history WHERE DATE(created_at) = ?', [today])?.n ?? 0;
    const activeWeek      = safeGet('SELECT COUNT(DISTINCT user_id) as n FROM history WHERE DATE(created_at) >= ?', [weekAgo])?.n ?? 0;
    const activeMonth     = safeGet('SELECT COUNT(DISTINCT user_id) as n FROM history WHERE DATE(created_at) >= ?', [monthAgo])?.n ?? 0;
    const queriesToday    = safeGet('SELECT COUNT(*) as n FROM history WHERE DATE(created_at) = ?', [today])?.n ?? 0;
    const queriesWeek     = safeGet('SELECT COUNT(*) as n FROM history WHERE DATE(created_at) >= ?', [weekAgo])?.n ?? 0;
    const queriesMonth    = safeGet('SELECT COUNT(*) as n FROM history WHERE DATE(created_at) >= ?', [monthAgo])?.n ?? 0;
    const costToday       = safeGet('SELECT COALESCE(SUM(cost_usd),0) as n FROM history WHERE DATE(created_at) = ?', [today])?.n ?? 0;
    const costMonth       = safeGet('SELECT COALESCE(SUM(cost_usd),0) as n FROM history WHERE DATE(created_at) >= ?', [monthAgo])?.n ?? 0;
    const signupsToday    = safeGet('SELECT COUNT(*) as n FROM users WHERE DATE(created_at) = ?', [today])?.n ?? 0;
    const signupsWeek     = safeGet('SELECT COUNT(*) as n FROM users WHERE DATE(created_at) >= ?', [weekAgo])?.n ?? 0;
    const signupsMonth    = safeGet('SELECT COUNT(*) as n FROM users WHERE DATE(created_at) >= ?', [monthAgo])?.n ?? 0;
    const pausedUsers     = safeGet('SELECT COUNT(*) as n FROM users WHERE paused = 1')?.n ?? 0;

    // MRR — count active paid users per plan
    const planCounts = safeAll(`SELECT plan, COUNT(*) as cnt FROM users WHERE plan NOT IN ('free','pro_demo') GROUP BY plan`);
    let mrr = 0;
    for (const row of planCounts) {
      const p = PLANS[row.plan];
      if (p) mrr += (p.price || 0) * row.cnt;
    }

    // Plan distribution
    const planDist = safeAll('SELECT plan, COUNT(*) as cnt FROM users GROUP BY plan ORDER BY cnt DESC');

    res.json({
      users: { total: totalUsers, activeToday, activeWeek, activeMonth, signupsToday, signupsWeek, signupsMonth, paused: pausedUsers },
      queries: { today: queriesToday, week: queriesWeek, month: queriesMonth },
      cost: { today: +costToday.toFixed(4), month: +costMonth.toFixed(4) },
      mrr: +mrr.toFixed(2),
      planDistribution: planDist,
    });
  });

  router.get('/dashboard/signups', (req, res) => {
    const days = Math.min(parseInt(req.query.days) || 30, 90);
    const rows = safeAll(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM users
      WHERE created_at >= DATE('now', ? || ' days')
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [`-${days}`]);
    res.json(rows);
  });

  router.get('/dashboard/revenue', (req, res) => {
    const days = Math.min(parseInt(req.query.days) || 30, 90);
    const rows = safeAll(`
      SELECT DATE(created_at) as date, COALESCE(SUM(amount_usd),0) as revenue
      FROM billing_events
      WHERE type IN ('subscription_created','charge') AND created_at >= DATE('now', ? || ' days')
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [`-${days}`]);
    res.json(rows);
  });

  router.get('/dashboard/cost-breakdown', (req, res) => {
    const days = Math.min(parseInt(req.query.days) || 30, 90);
    const rows = safeAll(`
      SELECT provider, COALESCE(SUM(cost_usd),0) as cost, COUNT(*) as queries
      FROM history
      WHERE created_at >= DATE('now', ? || ' days')
      GROUP BY provider
      ORDER BY cost DESC
    `, [`-${days}`]);
    res.json(rows);
  });

  // ── User Management ─────────────────────────────────────────────────────────

  router.get('/users', (req, res) => {
    const { search = '', plan = '', sort = 'created_at', page = 1, limit = 50 } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(100, parseInt(limit));
    const lim    = Math.min(100, parseInt(limit));
    const validSorts = ['created_at', 'email', 'username', 'plan', 'monthly_cost_usd', 'total_cost_usd', 'daily_queries'];
    const orderBy = validSorts.includes(sort) ? sort : 'created_at';

    let where = 'WHERE 1=1';
    const params = [];
    if (search) { where += ' AND (username LIKE ? OR email LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    if (plan)   { where += ' AND plan = ?'; params.push(plan); }

    const total = db.prepare(`SELECT COUNT(*) as n FROM users ${where}`).get(...params)?.n ?? 0;
    const users = db.prepare(`
      SELECT id, username, email, plan, role, monthly_cost_usd, total_cost_usd,
             daily_queries, paused, created_at, country, stripe_subscription_id
      FROM users ${where}
      ORDER BY ${orderBy} DESC
      LIMIT ? OFFSET ?
    `).all(...params, lim, offset);

    res.json({ total, page: parseInt(page), limit: lim, users });
  });

  router.get('/users/:id', (req, res) => {
    const user = safeGet(`
      SELECT id, username, email, plan, role, monthly_cost_usd, total_cost_usd,
             daily_queries, daily_queries_date, paused, created_at, country, city,
             birthdate, occupation, stripe_customer_id, stripe_subscription_id,
             plan_expires_at, billing_period_start, promo_code
      FROM users WHERE id = ?
    `, [req.params.id]);

    if (!user) return res.status(404).json({ error: 'User not found' });

    const queryStats = safeGet(`
      SELECT COUNT(*) as total_queries, COALESCE(SUM(cost_usd),0) as total_cost,
             MAX(created_at) as last_query
      FROM history WHERE user_id = ?
    `, [req.params.id]);

    const recentQueries = safeAll(`
      SELECT id, created_at, provider, model_id, cost_usd, duration_ms,
             SUBSTR(prompt, 1, 120) as prompt_preview
      FROM history WHERE user_id = ?
      ORDER BY created_at DESC LIMIT 10
    `, [req.params.id]);

    const billingEvents = safeAll(`
      SELECT type, amount_usd, description, created_at
      FROM billing_events WHERE user_id = ?
      ORDER BY created_at DESC LIMIT 20
    `, [req.params.id]);

    res.json({ ...user, queryStats, recentQueries, billingEvents });
  });

  router.put('/users/:id/plan', auditLog('user_plan_change'), (req, res) => {
    const { plan, reason } = req.body;
    if (!PLANS[plan]) return res.status(400).json({ error: 'Invalid plan' });

    db.prepare(`UPDATE users SET plan = ?, paused = 0 WHERE id = ?`).run(plan, req.params.id);
    db.prepare(`
      INSERT INTO billing_events (user_id, type, description)
      VALUES (?, 'plan_change', ?)
    `).run(req.params.id, `Admin changed plan to ${plan}. Reason: ${reason || 'N/A'}`);

    res.json({ ok: true });
  });

  router.put('/users/:id/pause', auditLog('user_pause_toggle'), (req, res) => {
    const { paused } = req.body;
    db.prepare('UPDATE users SET paused = ? WHERE id = ?').run(paused ? 1 : 0, req.params.id);
    res.json({ ok: true, paused: !!paused });
  });

  router.put('/users/:id/role', requireSuperAdmin, auditLog('user_role_change'), (req, res) => {
    const { role } = req.body;
    if (!['user', 'admin', 'superadmin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
    res.json({ ok: true });
  });

  router.post('/users/:id/impersonate', auditLog('impersonate_start'), (req, res) => {
    const targetId = parseInt(req.params.id);
    const target = safeGet('SELECT id, username, email FROM users WHERE id = ?', [targetId]);
    if (!target) return res.status(404).json({ error: 'User not found' });

    req.session.originalAdminId = req.session.userId;
    req.session.userId = targetId;
    res.json({ ok: true, impersonating: target });
  });

  router.post('/impersonate/stop', (req, res) => {
    if (!req.session.originalAdminId) {
      return res.status(400).json({ error: 'Not impersonating' });
    }
    const adminId = req.session.originalAdminId;
    req.session.userId = adminId;
    delete req.session.originalAdminId;
    res.json({ ok: true });
  });

  router.delete('/users/:id', requireSuperAdmin, auditLog('user_delete'), (req, res) => {
    const user = safeGet('SELECT id FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  // ── Revenue & Billing ───────────────────────────────────────────────────────

  router.get('/billing/mrr', (req, res) => {
    const byPlan = safeAll(`
      SELECT plan, COUNT(*) as users
      FROM users WHERE stripe_subscription_id IS NOT NULL AND paused = 0
      GROUP BY plan
    `);
    let mrr = 0;
    const breakdown = byPlan.map(row => {
      const price = PLANS[row.plan]?.price || 0;
      const planMrr = price * row.users;
      mrr += planMrr;
      return { plan: row.plan, users: row.users, price, mrr: +planMrr.toFixed(2) };
    });
    res.json({ mrr: +mrr.toFixed(2), breakdown });
  });

  router.get('/billing/events', (req, res) => {
    const { page = 1, limit = 50, type = '' } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(100, parseInt(limit));
    const lim    = Math.min(100, parseInt(limit));
    let where = 'WHERE 1=1';
    const params = [];
    if (type) { where += ' AND be.type = ?'; params.push(type); }

    const total = db.prepare(`SELECT COUNT(*) as n FROM billing_events be ${where}`).get(...params)?.n ?? 0;
    const events = db.prepare(`
      SELECT be.id, be.type, be.amount_usd, be.description, be.created_at,
             u.username, u.email, u.plan
      FROM billing_events be
      JOIN users u ON u.id = be.user_id
      ${where}
      ORDER BY be.created_at DESC LIMIT ? OFFSET ?
    `).all(...params, lim, offset);

    res.json({ total, page: parseInt(page), limit: lim, events });
  });

  router.get('/billing/user-economics', (req, res) => {
    const { sort = 'cost', limit = 50 } = req.query;
    const validSorts = { cost: 'api_cost DESC', revenue: 'plan_price DESC', deficit: '(api_cost - plan_price) DESC' };
    const orderBy = validSorts[sort] || validSorts.cost;
    const lim = Math.min(200, parseInt(limit));

    const rows = safeAll(`
      SELECT u.id, u.username, u.email, u.plan, u.monthly_cost_usd as api_cost,
             u.paused, u.stripe_subscription_id,
             u.created_at
      FROM users u
      ORDER BY u.monthly_cost_usd DESC
      LIMIT ?
    `, [lim]);

    const result = rows.map(r => ({
      ...r,
      plan_price: PLANS[r.plan]?.price || 0,
      deficit: +(r.api_cost - (PLANS[r.plan]?.price || 0)).toFixed(4),
    }));

    res.json(result);
  });

  // ── Usage Analytics ─────────────────────────────────────────────────────────

  router.get('/analytics/queries', (req, res) => {
    const days = Math.min(parseInt(req.query.days) || 30, 90);
    const rows = safeAll(`
      SELECT DATE(created_at) as date, COUNT(*) as queries,
             COALESCE(SUM(cost_usd),0) as cost
      FROM history
      WHERE created_at >= DATE('now', ? || ' days')
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [`-${days}`]);
    res.json(rows);
  });

  router.get('/analytics/models', (req, res) => {
    const days = Math.min(parseInt(req.query.days) || 30, 90);
    const rows = safeAll(`
      SELECT model_id, provider, COUNT(*) as queries,
             COALESCE(SUM(cost_usd),0) as cost,
             COALESCE(AVG(duration_ms),0) as avg_duration_ms
      FROM history
      WHERE created_at >= DATE('now', ? || ' days')
      GROUP BY model_id
      ORDER BY queries DESC
    `, [`-${days}`]);
    res.json(rows);
  });

  router.get('/analytics/providers', (req, res) => {
    const days = Math.min(parseInt(req.query.days) || 30, 90);
    const rows = safeAll(`
      SELECT provider, COUNT(*) as queries, COALESCE(SUM(cost_usd),0) as cost,
             COUNT(DISTINCT user_id) as unique_users
      FROM history
      WHERE created_at >= DATE('now', ? || ' days')
      GROUP BY provider
      ORDER BY cost DESC
    `, [`-${days}`]);
    res.json(rows);
  });

  router.get('/analytics/top-users', (req, res) => {
    const { limit = 20, days = 30 } = req.query;
    const lim = Math.min(100, parseInt(limit));
    const d   = Math.min(90, parseInt(days));
    const rows = safeAll(`
      SELECT u.id, u.username, u.email, u.plan,
             COUNT(h.id) as queries, COALESCE(SUM(h.cost_usd),0) as cost,
             MAX(h.created_at) as last_query
      FROM history h JOIN users u ON u.id = h.user_id
      WHERE h.created_at >= DATE('now', ? || ' days')
      GROUP BY h.user_id
      ORDER BY queries DESC LIMIT ?
    `, [`-${d}`, lim]);
    res.json(rows);
  });

  router.get('/analytics/peak-hours', (req, res) => {
    const rows = safeAll(`
      SELECT CAST(strftime('%H', created_at) AS INTEGER) as hour,
             COUNT(*) as queries
      FROM history
      WHERE created_at >= DATE('now', '-30 days')
      GROUP BY hour
      ORDER BY hour ASC
    `);
    res.json(rows);
  });

  router.get('/analytics/modes', (req, res) => {
    const days = Math.min(parseInt(req.query.days) || 30, 90);
    const integrator = safeGet(`SELECT COUNT(*) as n FROM history WHERE is_integrator = 1 AND created_at >= DATE('now', ? || ' days')`, [`-${days}`])?.n ?? 0;
    const debate     = safeGet(`SELECT COUNT(*) as n FROM debate_responses WHERE created_at >= DATE('now', ? || ' days')`, [`-${days}`])?.n ?? 0;
    const regular    = safeGet(`SELECT COUNT(*) as n FROM history WHERE is_integrator = 0 AND created_at >= DATE('now', ? || ' days')`, [`-${days}`])?.n ?? 0;
    res.json({ integrator, debate, regular, total: integrator + debate + regular });
  });

  // ── Model Management ────────────────────────────────────────────────────────

  router.get('/models/sync', (req, res) => {
    syncModelConfig();
    res.json({ ok: true });
  });

  router.get('/models', (req, res) => {
    syncModelConfig();
    const models = safeAll(`SELECT * FROM model_config ORDER BY provider, sort_order, model_id`);
    // Join with usage stats
    const stats = safeAll(`
      SELECT model_id, COUNT(*) as queries, COALESCE(SUM(cost_usd),0) as cost,
             MAX(created_at) as last_used
      FROM history
      WHERE created_at >= DATE('now', '-30 days')
      GROUP BY model_id
    `);
    const statsMap = Object.fromEntries(stats.map(s => [s.model_id, s]));
    res.json(models.map(m => ({ ...m, ...statsMap[m.model_id] })));
  });

  router.put('/models/:modelId', auditLog('model_config_update'), (req, res) => {
    const { enabled, price_input, price_output, display_name, sort_order } = req.body;
    db.prepare(`
      UPDATE model_config
      SET enabled = COALESCE(?, enabled),
          price_input = COALESCE(?, price_input),
          price_output = COALESCE(?, price_output),
          display_name = COALESCE(?, display_name),
          sort_order = COALESCE(?, sort_order),
          updated_at = CURRENT_TIMESTAMP
      WHERE model_id = ?
    `).run(
      enabled !== undefined ? (enabled ? 1 : 0) : null,
      price_input ?? null, price_output ?? null,
      display_name ?? null, sort_order ?? null,
      req.params.modelId
    );
    res.json({ ok: true });
  });

  // ── Promo Codes ─────────────────────────────────────────────────────────────

  router.get('/promos', (req, res) => {
    const promos = safeAll(`
      SELECT p.*, COUNT(u.id) as redemptions
      FROM promo_codes p
      LEFT JOIN users u ON u.promo_code = p.code
      GROUP BY p.code
      ORDER BY p.created_at DESC
    `);
    res.json(promos);
  });

  router.post('/promos', auditLog('promo_create'), (req, res) => {
    const { code, plan = 'pro_demo', budget_usd = 3, max_uses = 1, expires_at = null } = req.body;
    if (!code || code.length < 4) return res.status(400).json({ error: 'Code must be at least 4 characters' });
    try {
      db.prepare(`
        INSERT INTO promo_codes (code, plan, budget_usd, max_uses, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(code.toUpperCase(), plan, budget_usd, max_uses, expires_at);
      res.json({ ok: true });
    } catch (e) {
      res.status(409).json({ error: 'Code already exists' });
    }
  });

  router.delete('/promos/:code', requireSuperAdmin, auditLog('promo_delete'), (req, res) => {
    db.prepare('DELETE FROM promo_codes WHERE code = ?').run(req.params.code.toUpperCase());
    res.json({ ok: true });
  });

  // ── Content Moderation ──────────────────────────────────────────────────────

  router.get('/moderation/queries', (req, res) => {
    const { page = 1, limit = 50, userId = '' } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(100, parseInt(limit));
    const lim    = Math.min(100, parseInt(limit));
    let where = 'WHERE 1=1';
    const params = [];
    if (userId) { where += ' AND h.user_id = ?'; params.push(userId); }

    const total = db.prepare(`SELECT COUNT(*) as n FROM history h ${where}`).get(...params)?.n ?? 0;
    const rows = db.prepare(`
      SELECT h.id, h.created_at, h.provider, h.model_id, h.cost_usd, h.duration_ms,
             SUBSTR(h.prompt, 1, 200) as prompt_preview,
             u.username, u.email, u.plan
      FROM history h JOIN users u ON u.id = h.user_id
      ${where}
      ORDER BY h.created_at DESC LIMIT ? OFFSET ?
    `).all(...params, lim, offset);

    res.json({ total, page: parseInt(page), limit: lim, rows });
  });

  router.get('/moderation/queries/:id', (req, res) => {
    const row = safeGet(`
      SELECT h.*, u.username, u.email
      FROM history h JOIN users u ON u.id = h.user_id
      WHERE h.id = ?
    `, [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  });

  // ── System Health ────────────────────────────────────────────────────────────

  router.get('/health', (req, res) => {
    const mem        = process.memoryUsage();
    const uptimeSec  = Math.floor(process.uptime());
    const dbSize     = (() => {
      try {
        const { size } = require('fs').statSync(
          db.name || require('path').join(__dirname, 'data.db')
        );
        return size;
      } catch { return null; }
    })();
    const sessionCount = safeGet('SELECT COUNT(*) as n FROM sessions')?.n ?? 'N/A';
    const userCount    = safeGet('SELECT COUNT(*) as n FROM users')?.n ?? 0;
    const histCount    = safeGet('SELECT COUNT(*) as n FROM history')?.n ?? 0;

    res.json({
      uptime: uptimeSec,
      uptimeHuman: `${Math.floor(uptimeSec/3600)}h ${Math.floor((uptimeSec%3600)/60)}m`,
      memory: {
        rss:  +(mem.rss / 1048576).toFixed(1),
        heap: +(mem.heapUsed / 1048576).toFixed(1),
        heapTotal: +(mem.heapTotal / 1048576).toFixed(1),
      },
      db: { sizeBytes: dbSize, sizeMb: dbSize ? +(dbSize/1048576).toFixed(2) : null, userCount, histCount },
      sessions: sessionCount,
      nodeVersion: process.version,
    });
  });

  router.get('/health/errors', (req, res) => {
    const days = Math.min(parseInt(req.query.days) || 7, 30);
    const rows = safeAll(`
      SELECT metric_type, provider, model_id, value, details, created_at
      FROM system_metrics
      WHERE metric_type = 'error' AND created_at >= DATE('now', ? || ' days')
      ORDER BY created_at DESC LIMIT 200
    `, [`-${days}`]);
    res.json(rows);
  });

  router.get('/health/response-times', (req, res) => {
    const days = Math.min(parseInt(req.query.days) || 7, 30);
    const rows = safeAll(`
      SELECT provider, model_id,
             AVG(value) as avg_ms, MIN(value) as min_ms, MAX(value) as max_ms,
             COUNT(*) as samples
      FROM system_metrics
      WHERE metric_type = 'response_time' AND created_at >= DATE('now', ? || ' days')
      GROUP BY provider, model_id
      ORDER BY avg_ms DESC
    `, [`-${days}`]);
    res.json(rows);
  });

  // ── Live SSE ─────────────────────────────────────────────────────────────────

  router.get('/live', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

    let lastQueryId = safeGet('SELECT MAX(id) as n FROM history')?.n ?? 0;
    let lastUserId  = safeGet('SELECT MAX(id) as n FROM users')?.n ?? 0;

    const interval = setInterval(() => {
      // New queries since last check
      const newQueries = safeAll('SELECT id, provider, model_id, cost_usd, created_at FROM history WHERE id > ? ORDER BY id ASC LIMIT 10', [lastQueryId]);
      if (newQueries.length) {
        lastQueryId = newQueries[newQueries.length - 1].id;
        send('queries', newQueries);
      }
      // New signups since last check
      const newUsers = safeAll('SELECT id, username, email, plan, created_at FROM users WHERE id > ? ORDER BY id ASC LIMIT 5', [lastUserId]);
      if (newUsers.length) {
        lastUserId = newUsers[newUsers.length - 1].id;
        send('signups', newUsers);
      }
    }, 5000);

    req.on('close', () => clearInterval(interval));
  });

  // ── Audit Log ────────────────────────────────────────────────────────────────

  router.get('/audit', (req, res) => {
    const { page = 1, limit = 50, action = '', admin_id = '' } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(100, parseInt(limit));
    const lim    = Math.min(100, parseInt(limit));
    let where = 'WHERE 1=1';
    const params = [];
    if (action)   { where += ' AND a.action = ?'; params.push(action); }
    if (admin_id) { where += ' AND a.admin_id = ?'; params.push(admin_id); }

    const total = db.prepare(`SELECT COUNT(*) as n FROM admin_audit_log a ${where}`).get(...params)?.n ?? 0;
    const rows  = db.prepare(`
      SELECT a.id, a.action, a.target_id, a.details, a.ip_address, a.created_at,
             u.username as admin_username, u.email as admin_email
      FROM admin_audit_log a JOIN users u ON u.id = a.admin_id
      ${where}
      ORDER BY a.created_at DESC LIMIT ? OFFSET ?
    `).all(...params, lim, offset);

    res.json({ total, page: parseInt(page), limit: lim, rows });
  });

  return router;
};
