import { Router, Request, Response } from 'express';
import { authenticate, requireRole, query, queryOne, successResponse, errorResponse } from '@nirmalmandi/shared';
import { v4 as uuidv4 } from 'uuid';

export const sectorsRouter = Router();

// ── GET /sectors ─────────────────────────────────────────────
sectorsRouter.get('/', async (_req, res: Response) => {
  const sectors = await query(
    'SELECT id, name, slug, parent_id, schema_definition, commission_rate, gst_rate, pricing_mode_default, status FROM sectors WHERE status = $1 ORDER BY name',
    ['active']
  );
  res.json({ success: true, data: sectors });
});

// ── GET /sectors/:slug ────────────────────────────────────────
sectorsRouter.get('/:slug', async (req: Request, res: Response) => {
  const sector = await queryOne(
    'SELECT * FROM sectors WHERE slug = $1 AND status = $2',
    [req.params.slug, 'active']
  );
  if (!sector) { res.status(404).json(errorResponse('Sector not found')); return; }
  res.json({ success: true, data: sector });
});

// ── POST /sectors (admin) ─────────────────────────────────────
sectorsRouter.post(
  '/',
  authenticate,
  requireRole('admin', 'super_admin'),
  async (req: Request, res: Response) => {
    const { name, slug, schema_definition, commission_rate, gst_rate, is_ai_generated, admin_approved } = req.body;
    const id = uuidv4();
    await query(
      `INSERT INTO sectors (id, name, slug, schema_definition, commission_rate, gst_rate, is_ai_generated, admin_approved)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8)`,
      [id, name, slug, JSON.stringify(schema_definition || {}), commission_rate || 0.03, gst_rate || 0.18, is_ai_generated || false, admin_approved !== false]
    );
    res.status(201).json({ success: true, data: { id } });
  }
);

// ── PATCH /sectors/:id (admin approval of AI-generated) ───────
sectorsRouter.patch(
  '/:id',
  authenticate,
  requireRole('admin', 'super_admin'),
  async (req: Request, res: Response) => {
    const { name, slug, schema_definition, admin_approved, status } = req.body;
    await query(
      `UPDATE sectors SET name=COALESCE($2,name), slug=COALESCE($3,slug),
       schema_definition=COALESCE($4::jsonb,schema_definition),
       admin_approved=COALESCE($5,admin_approved), status=COALESCE($6,status),
       updated_at=NOW() WHERE id=$1`,
      [req.params.id, name, slug, schema_definition ? JSON.stringify(schema_definition) : null, admin_approved, status]
    );
    res.json({ success: true, data: { message: 'Sector updated' } });
  }
);
