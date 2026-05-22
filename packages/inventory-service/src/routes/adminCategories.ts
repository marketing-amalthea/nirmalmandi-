import { Router, Request, Response } from 'express';
import { authenticate, query, queryOne, successResponse, errorResponse } from '@nirmalmandi/shared';
import { v4 as uuidv4 } from 'uuid';

export const adminCategoriesRouter = Router();

function requireAdmin(req: Request, res: Response, next: () => void): void {
  const role = (req as any).user?.role;
  if (role !== 'admin' && role !== 'super_admin') {
    res.status(403).json(errorResponse('Forbidden: admin access required'));
    return;
  }
  next();
}

// ── GET /admin/categories ─────────────────────────────────────
// All sectors (including inactive) with live listing counts
adminCategoriesRouter.get('/', authenticate, requireAdmin as any, async (_req: Request, res: Response) => {
  try {
    const rows = await query(
      `SELECT
         s.id,
         s.name,
         s.slug,
         s.status,
         s.commission_rate  AS "commissionRate",
         s.gst_rate         AS "gstRate",
         s.admin_approved   AS "adminApproved",
         s.is_ai_generated  AS "isAiGenerated",
         s.created_at       AS "createdAt",
         COUNT(l.id) FILTER (
           WHERE l.status IN ('live','active') AND l.deleted_at IS NULL
         )::int             AS "listingCount"
       FROM sectors s
       LEFT JOIN listings l ON l.sector_id = s.id
       GROUP BY s.id
       ORDER BY s.name ASC`,
      []
    );
    res.json(successResponse({ rows, total: rows.length }));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message || 'Internal server error'));
  }
});

// ── POST /admin/categories ────────────────────────────────────
adminCategoriesRouter.post('/', authenticate, requireAdmin as any, async (req: Request, res: Response) => {
  try {
    const { name, slug, commission_rate, gst_rate } = req.body;
    if (!name || !slug) {
      res.status(400).json(errorResponse('name and slug are required'));
      return;
    }

    // Basic slug validation
    if (!/^[a-z0-9-]+$/.test(slug)) {
      res.status(400).json(errorResponse('slug must be lowercase letters, numbers, and hyphens only'));
      return;
    }

    const id = uuidv4();
    await query(
      `INSERT INTO sectors (id, name, slug, commission_rate, gst_rate, admin_approved, status)
       VALUES ($1, $2, $3, $4, $5, true, 'active')`,
      [
        id,
        name.trim(),
        slug.trim(),
        commission_rate != null ? Number(commission_rate) : 0.03,
        gst_rate != null ? Number(gst_rate) : 0.18,
      ]
    );
    const sector = await queryOne(
      `SELECT s.*, 0::int AS "listingCount" FROM sectors s WHERE s.id = $1`,
      [id]
    );
    res.status(201).json(successResponse(sector));
  } catch (err: any) {
    if (err.code === '23505') {
      res.status(409).json(errorResponse('A sector with this slug already exists'));
      return;
    }
    res.status(500).json(errorResponse(err.message || 'Internal server error'));
  }
});

// ── PATCH /admin/categories/:id ───────────────────────────────
adminCategoriesRouter.patch('/:id', authenticate, requireAdmin as any, async (req: Request, res: Response) => {
  try {
    const { name, slug, commission_rate, gst_rate, admin_approved } = req.body;

    if (slug && !/^[a-z0-9-]+$/.test(slug)) {
      res.status(400).json(errorResponse('slug must be lowercase letters, numbers, and hyphens only'));
      return;
    }

    await query(
      `UPDATE sectors SET
         name            = COALESCE($2, name),
         slug            = COALESCE($3, slug),
         commission_rate = COALESCE($4, commission_rate),
         gst_rate        = COALESCE($5, gst_rate),
         admin_approved  = COALESCE($6, admin_approved),
         updated_at      = NOW()
       WHERE id = $1`,
      [
        req.params.id,
        name ?? null,
        slug ?? null,
        commission_rate != null ? Number(commission_rate) : null,
        gst_rate != null ? Number(gst_rate) : null,
        admin_approved != null ? Boolean(admin_approved) : null,
      ]
    );

    const sector = await queryOne('SELECT * FROM sectors WHERE id = $1', [req.params.id]);
    if (!sector) { res.status(404).json(errorResponse('Sector not found')); return; }
    res.json(successResponse(sector));
  } catch (err: any) {
    if (err.code === '23505') {
      res.status(409).json(errorResponse('Slug already in use'));
      return;
    }
    res.status(500).json(errorResponse(err.message || 'Internal server error'));
  }
});

// ── PATCH /admin/categories/:id/toggle ───────────────────────
adminCategoriesRouter.patch('/:id/toggle', authenticate, requireAdmin as any, async (req: Request, res: Response) => {
  try {
    const sector = await queryOne<{ status: string }>(
      'SELECT status FROM sectors WHERE id = $1',
      [req.params.id]
    );
    if (!sector) { res.status(404).json(errorResponse('Sector not found')); return; }

    const newStatus = sector.status === 'active' ? 'inactive' : 'active';
    await query(
      'UPDATE sectors SET status = $1, updated_at = NOW() WHERE id = $2',
      [newStatus, req.params.id]
    );
    res.json(successResponse({ id: req.params.id, status: newStatus }));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message || 'Internal server error'));
  }
});
