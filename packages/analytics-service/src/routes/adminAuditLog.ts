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

  // Build filter params separately for reuse in both list + count queries
  const filterParams: (string | number)[] = [];
  const conditions: string[] = [];
  if (adminId) { conditions.push(`al.user_id = $${filterParams.push(adminId)}`); }
  if (entityType) { conditions.push(`al.entity_type = $${filterParams.push(entityType)}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  // List query — filter params first, then limit/offset
  const listParams = [...filterParams, limit, offset];
  const limitIdx = filterParams.length + 1;
  const offsetIdx = filterParams.length + 2;

  const rows = await query(
    `SELECT al.id, al.action, al.user_id,
            al.entity_type   AS "entityType",
            al.entity_id     AS "entityId",
            al.ip_address    AS "ipAddress",
            al.old_value     AS "oldValue",
            al.new_value     AS "newValue",
            al.created_at    AS "timestamp",
            u.name           AS "adminName",
            u.email          AS "adminEmail"
     FROM audit_logs al
     LEFT JOIN users u ON u.id = al.user_id
     ${where}
     ORDER BY al.created_at DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    listParams
  );

  const [{ count }] = await query<{ count: string }>(
    `SELECT COUNT(*) FROM audit_logs al LEFT JOIN users u ON u.id = al.user_id ${where}`,
    filterParams
  );

  res.json(successResponse({ rows, total: parseInt(count, 10), page, limit }));
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
