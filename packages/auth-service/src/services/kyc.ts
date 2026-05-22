import axios from 'axios';
import { logger } from '@nirmalmandi/shared';

export interface BankVerificationResult {
  valid: boolean;
  name_match_score?: number;
  message?: string;
}

export async function verifyBankAccount(
  accountNumber: string,
  ifsc: string,
  businessName: string
): Promise<BankVerificationResult> {
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    logger.info('[DEV] Bank verification skipped — returning valid');
    return { valid: true, name_match_score: 1.0 };
  }

  try {
    const res = await axios.post(
      `${process.env.KARZA_BASE_URL}/v3/bank-account-verification`,
      { account_number: accountNumber, ifsc, name: businessName },
      {
        headers: {
          'x-karza-key': process.env.KARZA_API_KEY!,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    const { status, name_match_score } = res.data;
    return {
      valid: status === 'valid' && name_match_score > 0.80,
      name_match_score,
    };
  } catch (err) {
    logger.error('Bank verification API failed', { error: err });
    return { valid: false, message: 'Verification service unavailable' };
  }
}
