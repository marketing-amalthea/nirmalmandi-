/**
 * Board-Ready PDF Report Generator
 * Combines all BI engine outputs into a single executive PDF.
 * Uploaded to S3; URL cached in board_reports table.
 */
import PDFDocument from 'pdfkit';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { query, queryOne, logger } from '@nirmalmandi/shared';
import { getPlatformKpis } from './kpis';
import { getDemandSupplyGap } from './demandSupply';
import { getCvrSignals } from './cvrOptimization';
import { getGeoDemand } from './geoDemand';
import { getSellerAcquisitionTargets } from './sellerAcquisition';
import { getRevenueForecast } from './revenueForecast';

const s3 = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
const BUCKET = process.env.S3_BUCKET_NAME || 'nirmalmandi-assets';
const CDN    = process.env.CLOUDFRONT_URL  || `https://${BUCKET}.s3.amazonaws.com`;

const NM_BLUE = '#1d4ed8';
const NM_GRAY = '#374151';
const W = 495; // usable width

function fmt(n: number): string {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)}Cr`;
  if (n >= 100_000)    return `₹${(n / 100_000).toFixed(2)}L`;
  if (n >= 1_000)      return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
}

function fmtN(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function sectionHeader(doc: PDFKit.PDFDocument, title: string, y: number): number {
  doc.fillColor(NM_BLUE).rect(50, y, W, 22).fill();
  doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold').text(title, 58, y + 6);
  return y + 30;
}

function kpiRow(doc: PDFKit.PDFDocument, items: Array<{ label: string; value: string; sub?: string }>, y: number): number {
  const colW = W / items.length;
  items.forEach((item, i) => {
    const x = 50 + i * colW;
    doc.rect(x, y, colW - 4, 48).fillColor('#f9fafb').fill().strokeColor('#e5e7eb').lineWidth(0.5).stroke();
    doc.fillColor(NM_GRAY).fontSize(7).font('Helvetica').text(item.label, x + 6, y + 6, { width: colW - 12 });
    doc.fillColor('#111827').fontSize(14).font('Helvetica-Bold').text(item.value, x + 6, y + 16);
    if (item.sub) doc.fillColor('#6b7280').fontSize(7).font('Helvetica').text(item.sub, x + 6, y + 36);
  });
  return y + 56;
}

function dataTable(
  doc: PDFKit.PDFDocument,
  headers: string[],
  rows: string[][],
  y: number,
  colWidths?: number[]
): number {
  const cw = colWidths ?? headers.map(() => W / headers.length);
  // Header
  doc.fillColor('#f3f4f6').rect(50, y, W, 16).fill();
  doc.fillColor(NM_GRAY).fontSize(7).font('Helvetica-Bold');
  let x = 50;
  headers.forEach((h, i) => { doc.text(h, x + 3, y + 4, { width: cw[i] - 6 }); x += cw[i]; });
  y += 16;
  // Rows
  rows.slice(0, 8).forEach((row, ri) => {
    const bg = ri % 2 === 0 ? '#ffffff' : '#f9fafb';
    doc.fillColor(bg).rect(50, y, W, 14).fill();
    doc.fillColor('#111827').fontSize(7).font('Helvetica');
    x = 50;
    row.forEach((cell, i) => { doc.text(String(cell ?? '—'), x + 3, y + 3, { width: cw[i] - 6 }); x += cw[i]; });
    y += 14;
  });
  doc.rect(50, y - rows.slice(0,8).length * 14 - 16, W, rows.slice(0,8).length * 14 + 16)
    .strokeColor('#e5e7eb').lineWidth(0.5).stroke();
  return y + 8;
}

export async function generateBoardReport(period: string, generatedBy: string): Promise<string> {
  // Gather all data in parallel
  const [kpis, demandGap, cvr, geo, sellers, forecast] = await Promise.all([
    getPlatformKpis('month'),
    getDemandSupplyGap(),
    getCvrSignals(30),
    getGeoDemand(30),
    getSellerAcquisitionTargets(),
    getRevenueForecast(),
  ]);

  const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));

  const generatedDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

  // ── Cover ──────────────────────────────────────────────────────────────────
  doc.fillColor(NM_BLUE).rect(0, 0, 595, 200).fill();
  doc.fillColor('#ffffff').fontSize(28).font('Helvetica-Bold').text('NirmalMandi', 50, 70);
  doc.fontSize(14).font('Helvetica').text('Board Intelligence Report', 50, 105);
  doc.fontSize(10).text(`Period: ${period}  ·  Generated: ${generatedDate}`, 50, 125);
  doc.fillColor('#93c5fd').rect(0, 200, 595, 4).fill();
  doc.moveDown(8);

  // ── Section 1: Platform KPIs ──────────────────────────────────────────────
  let y = 230;
  y = sectionHeader(doc, '1. PLATFORM KPIs (Month)', y);
  y = kpiRow(doc, [
    { label: 'GMV', value: fmt(Number((kpis as any)?.gmv?.value ?? 0)), sub: `${(kpis as any)?.gmv?.trend ?? 0}% vs prev` },
    { label: 'Completed Orders', value: fmtN(Number((kpis as any)?.completed_orders?.value ?? 0)) },
    { label: 'Commission', value: fmt(Number((kpis as any)?.commission?.value ?? 0)) },
    { label: 'Active Sellers', value: fmtN(Number((kpis as any)?.active_sellers?.value ?? 0)) },
    { label: 'Active Buyers', value: fmtN(Number((kpis as any)?.active_buyers?.value ?? 0)) },
  ], y);

  y += 8;

  // ── Section 2: CVR by Sector ──────────────────────────────────────────────
  y = sectionHeader(doc, '2. CONVERSION RATE BY SECTOR (Engine 7)', y);
  y = dataTable(doc,
    ['Sector', 'Views', 'Orders', 'CVR %', 'Avg Price'],
    (cvr.bySector ?? []).map(r => [
      r.sector_name,
      fmtN(r.listing_views),
      fmtN(r.orders),
      `${r.cvr_pct ?? 0}%`,
      fmt(r.avg_price),
    ]),
    y,
    [150, 70, 70, 60, 145]
  );

  // ── Section 3: Geographic Demand ──────────────────────────────────────────
  y = sectionHeader(doc, '3. GEOGRAPHIC DEMAND (Engine 8)', y);
  y = dataTable(doc,
    ['State', 'Buyer Events', 'GMV', 'Orders', 'Live Listings', 'Demand Score'],
    (geo.byState ?? []).map(r => [
      r.state,
      fmtN(r.buyer_events),
      fmt(r.gmv_30d),
      fmtN(r.orders_30d),
      fmtN(r.live_listings),
      String(r.demand_score),
    ]),
    y,
    [120, 70, 70, 60, 80, 95]
  );

  // ── New page ──────────────────────────────────────────────────────────────
  doc.addPage();
  y = 50;

  // ── Section 4: Demand-Supply Gaps ────────────────────────────────────────
  y = sectionHeader(doc, '4. DEMAND-SUPPLY GAPS (Engine 1)', y);
  y = dataTable(doc,
    ['Sector', 'Search Events', 'Live Listings', 'Active Sellers', 'Gap Ratio'],
    (sellers.sectorGaps ?? []).map(r => [
      r.sector_name,
      fmtN(r.search_events),
      fmtN(r.live_listings),
      fmtN(r.active_sellers),
      `${r.demand_supply_ratio}x`,
    ]),
    y,
    [160, 90, 80, 90, 75]
  );

  // ── Section 5: Seller Acquisition Opportunities ───────────────────────────
  y = sectionHeader(doc, '5. SELLER ACQUISITION TARGETS (Engine 6)', y);
  y = dataTable(doc,
    ['State', 'Buyer Events', 'Registered Sellers', 'Opportunity Score'],
    (sellers.geoGaps ?? []).map(r => [
      r.state,
      fmtN(r.buyer_events),
      fmtN(r.registered_sellers),
      String(r.opportunity_score),
    ]),
    y,
    [160, 100, 130, 105]
  );

  // ── Section 6: Revenue Forecast ───────────────────────────────────────────
  y = sectionHeader(doc, '6. REVENUE FORECAST (Engine 4)', y);
  const f = forecast as { next30Days?: number; next90Days?: number; confidence?: number } | null;
  y = kpiRow(doc, [
    { label: 'Next 30 Days GMV', value: fmt(Number(f?.next30Days ?? 0)) },
    { label: 'Next 90 Days GMV', value: fmt(Number(f?.next90Days ?? 0)) },
    { label: 'Confidence', value: `${f?.confidence ?? 0}%` },
  ], y);

  // ── Footer on all pages ───────────────────────────────────────────────────
  const totalPages = doc.bufferedPageRange().count;
  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(i);
    doc.fillColor(NM_BLUE).rect(0, doc.page.height - 30, 595, 30).fill();
    doc.fillColor('#ffffff').fontSize(7).font('Helvetica')
      .text(
        `NirmalMandi Confidential · ${period} Board Report · Page ${i + 1} of ${totalPages}`,
        50, doc.page.height - 18, { width: W, align: 'center' }
      );
  }

  // Await end event before concat — PDFKit data events are async
  const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });

  const key = `board-reports/${period.replace(/\s/g, '-')}-${Date.now()}.pdf`;
  try {
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET, Key: key, Body: pdfBuffer, ContentType: 'application/pdf',
    }));
    const url = `${CDN}/${key}`;
    await query(
      `INSERT INTO board_reports (period, report_url, generated_by, kpi_snapshot)
       VALUES ($1, $2, $3, $4)`,
      [period, url, generatedBy, JSON.stringify({ gmv: (kpis as any)?.gmv?.value })]
    );
    return url;
  } catch (err) {
    logger.warn('S3 upload failed for board report', { error: (err as Error).message });
    return `data:application/pdf;base64,${pdfBuffer.toString('base64')}`;
  }
}
