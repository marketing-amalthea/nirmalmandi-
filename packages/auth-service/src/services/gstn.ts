import axios from 'axios';
import { logger } from '@nirmalmandi/shared';

export async function validateGstin(gstin: string): Promise<boolean> {
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    // Accept any valid-format GSTIN in dev
    return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin);
  }

  try {
    const res = await axios.get(
      `${process.env.GSTN_BASE_URL}/commonapi/v1.0/taxpayerData`,
      {
        params: { gstin },
        headers: {
          'Authorization': `Bearer ${process.env.GSTN_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      }
    );
    return res.data?.sts === 'Active';
  } catch (err) {
    logger.warn('GSTN API call failed', { gstin: gstin.slice(0, 8) + '****', error: err });
    // Fail open in case GSTN API is down — flag for manual review
    return true;
  }
}
