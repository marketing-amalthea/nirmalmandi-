/**
 * GST Computation Unit Tests — Doc 09 acceptance criteria.
 * Intrastate: CGST + SGST (split equally).
 * Interstate: IGST only.
 * Rounding: each component independently rounded to 2 dp.
 */
import { computeGST } from '../utils/commission';

describe('computeGST', () => {
  // ── Doc 09 acceptance test ────────────────────────────────────
  // NOTE: gstRate is passed as a decimal — 0.18 means 18%
  test('intrastate DL→DL: ₹1,00,000 at 18% → cgst=9000, sgst=9000, igst=0', () => {
    const result = computeGST(100000, 0.18, 'DL', 'DL');
    expect(result.cgst).toBe(9000);
    expect(result.sgst).toBe(9000);
    expect(result.igst).toBe(0);
    expect(result.total_gst).toBe(18000);
  });

  test('interstate MH→DL: ₹1,00,000 at 18% → igst=18000, cgst=0, sgst=0', () => {
    const result = computeGST(100000, 0.18, 'DL', 'MH');
    expect(result.igst).toBe(18000);
    expect(result.cgst).toBe(0);
    expect(result.sgst).toBe(0);
    expect(result.total_gst).toBe(18000);
  });

  test('intrastate MH→MH: ₹50,000 at 12% → cgst=3000, sgst=3000', () => {
    const result = computeGST(50000, 0.12, 'MH', 'MH');
    expect(result.cgst).toBe(3000);
    expect(result.sgst).toBe(3000);
    expect(result.igst).toBe(0);
    expect(result.total_gst).toBe(6000);
  });

  test('interstate KA→TN: ₹75,000 at 5% → igst=3750', () => {
    const result = computeGST(75000, 0.05, 'TN', 'KA');
    expect(result.igst).toBe(3750);
    expect(result.cgst).toBe(0);
    expect(result.sgst).toBe(0);
  });

  test('case insensitive state comparison (mh vs MH)', () => {
    const r1 = computeGST(10000, 0.18, 'MH', 'MH');
    const r2 = computeGST(10000, 0.18, 'mh', 'mh');
    expect(r1.cgst).toBe(r2.cgst);
    expect(r1.sgst).toBe(r2.sgst);
    expect(r1.igst).toBe(r2.igst);
  });

  test('28% GST: automobiles intrastate', () => {
    const result = computeGST(100000, 0.28, 'MH', 'MH');
    expect(result.cgst).toBe(14000);
    expect(result.sgst).toBe(14000);
    expect(result.total_gst).toBe(28000);
  });

  test('total_gst = cgst + sgst + igst in all cases', () => {
    const cases = [
      { rate: 0.18, buyer: 'DL', seller: 'MH' },
      { rate: 0.12, buyer: 'GJ', seller: 'GJ' },
      { rate: 0.05, buyer: 'TN', seller: 'KA' },
      { rate: 0.28, buyer: 'UP', seller: 'UP' },
    ];
    cases.forEach(({ rate, buyer, seller }) => {
      const r = computeGST(50000, rate, buyer, seller);
      expect(r.total_gst).toBe(r.cgst + r.sgst + r.igst);
    });
  });

  test('GST on commission: ₹3000 commission at 18% intrastate → cgst=270, sgst=270', () => {
    const result = computeGST(3000, 0.18, 'MH', 'MH');
    expect(result.cgst).toBe(270);
    expect(result.sgst).toBe(270);
    expect(result.total_gst).toBe(540);
  });

  test('CGST + SGST split evenly (no rounding asymmetry)', () => {
    const result = computeGST(33333, 0.18, 'DL', 'DL');
    expect(result.cgst).toBe(result.sgst);
    expect(result.total_gst).toBe(result.cgst + result.sgst);
  });

  test('zero amount returns all zeros', () => {
    const result = computeGST(0, 0.18, 'DL', 'MH');
    expect(result.cgst).toBe(0);
    expect(result.sgst).toBe(0);
    expect(result.igst).toBe(0);
    expect(result.total_gst).toBe(0);
  });
});
