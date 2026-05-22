import { Router, Request, Response } from 'express';
import axios from 'axios';
import { successResponse, errorResponse, logger } from '@nirmalmandi/shared';

export const freightRouter = Router();

/**
 * GET /freight/estimate
 * Calls Delhivery API to get freight rate for a shipment.
 * Used at checkout so buyer sees cost before confirming.
 */
freightRouter.get('/estimate', async (req: Request, res: Response) => {
  const { origin_pincode, dest_pincode, weight_kg, cod = 'false' } = req.query as Record<string, string>;

  if (!origin_pincode || !dest_pincode || !weight_kg) {
    res.status(400).json(errorResponse('origin_pincode, dest_pincode, weight_kg required'));
    return;
  }

  // Dev/test: return mock estimate
  if (process.env.NODE_ENV !== 'production') {
    const base = parseFloat(weight_kg) * 25 + 40;
    res.json(successResponse({
      estimated_cost: Math.round(base),
      estimated_days: 3,
      provider: 'delhivery',
      cod_available: true,
    }));
    return;
  }

  try {
    const resp = await axios.get(`${process.env.DELHIVERY_BASE_URL}/api/kinko/v1.0/kinko/check.json`, {
      params: {
        md: 'S', // surface
        ss: 'Delivered',
        o_pin: origin_pincode,
        d_pin: dest_pincode,
        cgm: Math.ceil(parseFloat(weight_kg) * 1000), // grams
        pt: cod === 'true' ? 'COD' : 'Pre-paid',
        cod: cod === 'true' ? parseFloat(req.query.order_amount as string || '0') : 0,
      },
      headers: { Authorization: `Token ${process.env.DELHIVERY_API_KEY}` },
      timeout: 8000,
    });

    const data = resp.data;
    res.json(successResponse({
      estimated_cost: data.estimated_rate ?? 0,
      estimated_days: data.tat ?? 3,
      provider: 'delhivery',
      cod_available: data.cod ?? false,
    }));
  } catch (err) {
    logger.warn('Delhivery rate fetch failed, using fallback', { error: err });
    const fallback = parseFloat(weight_kg) * 30 + 50;
    res.json(successResponse({ estimated_cost: Math.round(fallback), estimated_days: 4, provider: 'estimate' }));
  }
});
