/**
 * Platform settings — stored as key-value in platform_settings table.
 * Table is created automatically on first access.
 */
import { Router, Request, Response } from 'express';
import { authenticate, query, successResponse, errorResponse } from '@nirmalmandi/shared';

export const adminSettingsRouter = Router();

function requireAdmin(req: Request, res: Response, next: () => void): void {
  const role = (req as any).user?.role;
  if (role !== 'admin' && role !== 'super_admin') {
    res.status(403).json(errorResponse('Forbidden: admin access required'));
    return;
  }
  next();
}

// Sensible defaults — returned when a key has no DB record yet
const DEFAULTS: Record<string, string> = {
  platform_name: 'NirmalMandi',
  platform_gstin: '',
  platform_pan: '',
  support_email: 'support@nirmalmandi.com',
  support_phone: '',
  default_commission_rate: '3',       // %
  dispute_sla_hours: '72',
  auto_release_days: '7',
  max_listing_images: '10',
  min_order_value: '500',             // ₹
  tcs_rate: '1',                      // % (Section 194-O)
  enable_flash_sales: 'true',
  enable_auctions: 'true',
  enable_buyer_registration: 'true',
  enable_seller_registration: 'true',
  enable_whatsapp_notifications: 'true',
  maintenance_mode: 'false',
  // KPI alert thresholds
  alert_gmv_drop_pct: '20',          // % WoW GMV drop triggers alert
  alert_dispute_rate_pct: '5',        // % dispute rate per seller triggers flag
  alert_aging_days: '30',             // days before listing flagged as aging
  alert_low_cvr_pct: '1',             // % CVR below which alert fires
  weekly_report_emails: '',           // comma-separated admin emails for Monday report
};

async function ensureTable(): Promise<void> {
  await query(
    `CREATE TABLE IF NOT EXISTS platform_settings (
       key        TEXT PRIMARY KEY,
       value      TEXT NOT NULL DEFAULT '',
       updated_at TIMESTAMPTZ DEFAULT NOW()
     )`,
    []
  );
}

// ── GET /admin/settings ───────────────────────────────────────
adminSettingsRouter.get('/', authenticate, requireAdmin as any, async (_req: Request, res: Response) => {
  try {
    await ensureTable();
    const rows = await query('SELECT key, value FROM platform_settings', []) as { key: string; value: string }[];

    // Merge DB values over defaults
    const settings: Record<string, string> = { ...DEFAULTS };
    for (const row of rows) {
      settings[row.key] = row.value;
    }

    res.json(successResponse(settings));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message || 'Internal server error'));
  }
});

// ── PATCH /admin/settings ─────────────────────────────────────
// Body: { key: value, ... } — upserts each pair
adminSettingsRouter.patch('/', authenticate, requireAdmin as any, async (req: Request, res: Response) => {
  try {
    await ensureTable();
    const updates = req.body as Record<string, unknown>;

    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      res.status(400).json(errorResponse('Body must be a key-value object'));
      return;
    }

    const entries = Object.entries(updates);
    if (entries.length === 0) {
      res.status(400).json(errorResponse('No settings provided'));
      return;
    }

    // Upsert each setting
    for (const [key, value] of entries) {
      await query(
        `INSERT INTO platform_settings (key, value, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [key, String(value ?? '')]
      );
    }

    res.json(successResponse({ updated: entries.length }));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message || 'Internal server error'));
  }
});
