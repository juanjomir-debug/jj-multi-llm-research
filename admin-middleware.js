// admin-middleware.js — Auth middleware for admin routes
'use strict';

const db = require('./db');

function requireAdmin(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(req.session.userId);
  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  req.adminUser = user;
  next();
}

function requireSuperAdmin(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(req.session.userId);
  if (!user || user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Superadmin access required' });
  }
  req.adminUser = user;
  next();
}

// auditLog(action) — returns middleware that logs action to admin_audit_log
function auditLog(action) {
  return (req, res, next) => {
    const origJson = res.json.bind(res);
    res.json = (body) => {
      // Only log on success responses
      if (res.statusCode < 400) {
        try {
          const adminId = req.adminUser?.id || req.session?.userId;
          const targetId = req.params?.id ? parseInt(req.params.id) : null;
          db.prepare(`
            INSERT INTO admin_audit_log (admin_id, action, target_id, details, ip_address)
            VALUES (?, ?, ?, ?, ?)
          `).run(
            adminId,
            action,
            targetId,
            JSON.stringify({ body: req.body, params: req.params }),
            req.ip || req.headers['x-forwarded-for'] || 'unknown'
          );
        } catch (e) {
          console.warn('[audit log]', e.message);
        }
      }
      return origJson(body);
    };
    next();
  };
}

module.exports = { requireAdmin, requireSuperAdmin, auditLog };
