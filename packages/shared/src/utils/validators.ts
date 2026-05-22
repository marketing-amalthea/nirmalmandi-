import { z } from 'zod';

export const phoneSchema = z
  .string()
  .regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number');

export const gstSchema = z
  .string()
  .regex(
    /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
    'Invalid GSTIN format'
  );

export const panSchema = z
  .string()
  .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format');

export const ifscSchema = z
  .string()
  .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code');

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, 10000);
}

export function generateOrderNumber(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'NM-';
  for (let i = 0; i < 6; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export function generateInvoiceNumber(seq: number): string {
  return `NM-INV-${String(seq).padStart(8, '0')}`;
}

export function generateReferralCode(name: string): string {
  const base = name.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4).padEnd(4, 'X');
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `${base}${rand}`;
}
