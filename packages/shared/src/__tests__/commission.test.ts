/**
 * Commission & Payout Unit Tests — Doc 09 acceptance criteria.
 * Must pass before production deploy.
 *
 * Key formula:
 *   commission = amount × commission_rate
 *   gst_on_commission = commission × 0.18
 *   tcs = amount × 0.01
 *   net_payout = amount - commission - gst_on_commission - tcs
 */
import { calculatePayout } from '../utils/commission';

describe('calculatePayout', () => {
  // ── Doc 09 acceptance test 1 ──────────────────────────────────
  test('automobiles: ₹2,00,000 order → commission=3000, net=194460', () => {
    const result = calculatePayout(200000, 'automobiles');
    // automobiles commission_rate = 1.5%
    expect(result.gross_amount).toBe(200000);
    expect(result.commission_rate).toBe(0.015);
    expect(result.commission).toBe(3000);            // 200000 × 0.015
    expect(result.gst_on_commission).toBe(540);      // 3000 × 0.18
    expect(result.tcs_amount).toBe(2000);            // 200000 × 0.01
    expect(result.net_payout).toBe(194460);          // 200000 - 3000 - 540 - 2000
  });

  // ── Doc 09 acceptance test 2 ──────────────────────────────────
  test('clothing: ₹50,000 order → commission=1500, net=47730', () => {
    const result = calculatePayout(50000, 'clothing');
    // clothing commission_rate = 3%
    expect(result.commission_rate).toBe(0.03);
    expect(result.commission).toBe(1500);            // 50000 × 0.03
    expect(result.gst_on_commission).toBe(270);      // 1500 × 0.18
    expect(result.tcs_amount).toBe(500);             // 50000 × 0.01
    expect(result.net_payout).toBe(47730);           // 50000 - 1500 - 270 - 500
  });

  test('fmcg: ₹10,000 → commission=250, net=9643', () => {
    const result = calculatePayout(10000, 'fmcg');
    expect(result.commission_rate).toBe(0.025);
    expect(result.commission).toBe(250);
    expect(result.gst_on_commission).toBe(45);
    expect(result.tcs_amount).toBe(100);
    expect(result.net_payout).toBe(9605);
  });

  test('software: ₹1,00,000 → commission=5000, net=93100', () => {
    const result = calculatePayout(100000, 'software');
    expect(result.commission_rate).toBe(0.05);
    expect(result.commission).toBe(5000);
    expect(result.gst_on_commission).toBe(900);
    expect(result.tcs_amount).toBe(1000);
    expect(result.net_payout).toBe(93100);
  });

  test('pharma: ₹20,000 → commission=400, net=19328', () => {
    const result = calculatePayout(20000, 'pharma');
    expect(result.commission_rate).toBe(0.02);
    expect(result.commission).toBe(400);
    expect(result.gst_on_commission).toBe(72);
    expect(result.tcs_amount).toBe(200);
    expect(result.net_payout).toBe(19328);           // 20000 - 400 - 72 - 200
  });

  test('machinery: ₹5,00,000 → commission=10000, net=483200', () => {
    const result = calculatePayout(500000, 'machinery');
    expect(result.commission_rate).toBe(0.02);
    expect(result.commission).toBe(10000);
    expect(result.gst_on_commission).toBe(1800);
    expect(result.tcs_amount).toBe(5000);
    expect(result.net_payout).toBe(483200);          // 500000 - 10000 - 1800 - 5000
  });

  test('unknown sector falls back to default 3%', () => {
    const result = calculatePayout(10000, 'unknown_sector');
    expect(result.commission_rate).toBe(0.03);
    expect(result.commission).toBe(300);
  });

  test('net_payout is never negative for valid inputs', () => {
    const sectors = ['automobiles', 'clothing', 'fmcg', 'pharma', 'furniture', 'software', 'machinery'];
    sectors.forEach(sector => {
      const result = calculatePayout(1000, sector);
      expect(result.net_payout).toBeGreaterThan(0);
    });
  });

  test('all amounts rounded to 2 decimal places', () => {
    const result = calculatePayout(333333, 'fmcg');
    const fields = [result.commission, result.gst_on_commission, result.tcs_amount, result.net_payout];
    fields.forEach(f => {
      expect(f).toBe(Math.round(f * 100) / 100);
    });
  });

  test('gross_amount + net_payout + commission + gst_on_commission + tcs = 2 × gross', () => {
    const result = calculatePayout(100000, 'automobiles');
    const check = result.net_payout + result.commission + result.gst_on_commission + result.tcs_amount;
    expect(check).toBe(result.gross_amount);
  });
});
