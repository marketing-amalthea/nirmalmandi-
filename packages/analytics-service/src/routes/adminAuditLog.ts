import { Router, Request, Response } from 'express';
import { authenticate, requireRole, query, successResponse } from '@nirmalmandi/shared';

export const adminAuditLogRouter = Router();

const requireAdmin = requireRole('admin', 'super_admin');

// GET /admin/audit-log
adminAuditLogRouter.get('/', authenticate, requireAdmin as never, async (req: Request, res: Response) => {
  const adminId = req.query.admin_id as string | undefined;
  const entityType = req.query.entity_type as string | undefined;
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
  const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? '50'), 10)));
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: (string | number)[] = [limit, offset];
  if (adminId) { conditions.push(`al.user_id = $${params.push(adminId)}`); }
  if (entityType) { conditions.push(`al.entity_type = $${params.push(entityType)}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = await query(
    `SELECT al.*, u.name AS admin_name, u.email AS admin_email
     FROM audit_logs al
     LEFT JOIN users u ON u.id = al.user_id
     ${where}
     ORDER BY al.created_at DESC
     LIMIT $1 OFFSET $2`,
    params
  );

  const [{ count }] = await query<{ count: string }>(
    `SELECT COUNT(*) FROM audit_logs ${where ? where.replace(/\$(\d+)/g, (_, n) => `$${n}`) : ''}`,
    conditions.length ? params.slice(2) : []
  );

  res.json(successResponse({ data: rows, total: parseInt(count, 10), page, limit }));
});

// GET /admin/audit-log/admins
adminAuditLogRouter.get('/admins', authenticate, requireAdmin as never, async (_req, res: Response) => {
  const rows = await query(
    `SELECT DISTINCT u.id, u.name, u.email
     FROM audit_logs al
     JOIN users u ON u.id = al.user_id
     WHERE u.role IN ('admin','super_admin')
     ORDER BY u.name`
  );
  res.json(successResponse(rows));
});

// GET /admin/audit-log/export-csv
adminAuditLogRouter.get('/export-csv', authenticate, requireAdmin as never, async (req: Request, res: Response) => {
  const rows = await query<Record<string, unknown>>(
    `SELECT al.created_at, u.name AS admin, al.action, al.entity_type, al.entity_id, al.ip_address
     FROM audit_logs al
     LEFT JOIN users u ON u.id = al.user_id
     ORDER BY al.created_at DESC
     LIMIT 5000`
  );

  const header = 'timestamp,admin,action,entity_type,entity_id,ip_address\n';
  const csv = header + rows.map(r =>
    [r.created_at, r.admin, r.action, r.entity_type, r.entity_id, r.ip_address]
      .map(v => `"${String(v ?? '').replace(/"/g, '""')}"`)
      .join(',')
  ).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="audit-log.csv"');
  res.send(csv);
});
