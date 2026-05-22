/**
 * GST Invoice Generator.
 * Produces PDF invoices compliant with India GST rules.
 * Intrastate → CGST+SGST, Interstate → IGST.
 * TCS: 1% collected at source by platform.
 * Uploads to S3, returns CloudFront URL.
 */
import PDFDocument from 'pdfkit';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { computeGST, logger } from '@nirmalmandi/shared';
import { Writable, PassThrough } from 'stream';

const s3 = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
const BUCKET = process.env.S3_BUCKET_NAME || 'nirmalmandi-assets';
const CDN = process.env.CLOUDFRONT_URL || `https://${BUCKET}.s3.amazonaws.com`;

export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  orderId: string;
  orderNumber: string;

  // Seller (supplier)
  sellerName: string;
  sellerGstin: string;
  sellerAddress: string;
  sellerState: string;

  // Buyer (recipient)
  buyerName: string;
  buyerGstin?: string;
  buyerAddress: string;
  buyerState: string;

  // Items
  items: {
    description: string;
    hsn: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    gstRate: number;
  }[];

  // Platform
  platformName: string;
  platformGstin: string;
  commissionAmount: number;
  commissionGstRate: number;
  tcsAmount: number;
  netPayoutToSeller: number;
}

export async function generateGstInvoice(data: InvoiceData): Promise<string> {
  const isIntrastate = data.buyerState.toLowerCase() === data.sellerState.toLowerCase();

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const chunks: Buffer[] = [];

  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  await new Promise<void>((resolve) => {
    doc.on('end', () => resolve());
    buildPdf(doc, data, isIntrastate);
    doc.end();
  });

  const pdfBuffer = Buffer.concat(chunks);
  const key = `invoices/${data.invoiceDate.slice(0, 7)}/${data.invoiceNumber}.pdf`;

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: pdfBuffer,
    ContentType: 'application/pdf',
    Metadata: {
      orderId: data.orderId,
      invoiceNumber: data.invoiceNumber,
    },
  }));

  const url = `${CDN}/${key}`;
  logger.info('GST invoice generated', { invoiceNumber: data.invoiceNumber, url });
  return url;
}

function buildPdf(doc: PDFKit.PDFDocument, data: InvoiceData, isIntrastate: boolean): void {
  const primaryColor = '#1a472a';
  const accentColor = '#2d6a4f';

  // ── Header ───────────────────────────────────────────────────
  doc.rect(0, 0, doc.page.width, 80).fill(primaryColor);
  doc.fillColor('white').fontSize(22).font('Helvetica-Bold')
    .text('NirmalMandi', 50, 20);
  doc.fontSize(9).font('Helvetica')
    .text('B2B Dead Stock Liquidation Platform', 50, 46)
    .text('GSTIN: ' + data.platformGstin, 50, 58);

  doc.fillColor(accentColor).fontSize(18).font('Helvetica-Bold')
    .text('TAX INVOICE', 400, 25, { align: 'right' });
  doc.fillColor('#333').fontSize(9).font('Helvetica')
    .text(`Invoice No: ${data.invoiceNumber}`, 400, 50, { align: 'right' })
    .text(`Date: ${data.invoiceDate}`, 400, 62, { align: 'right' });

  doc.y = 100;

  // ── Parties ──────────────────────────────────────────────────
  doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold').text('SELLER (Supplier)', 50, 100);
  doc.fillColor('#333').fontSize(9).font('Helvetica')
    .text(data.sellerName, 50, 113)
    .text(data.sellerAddress, 50, 125)
    .text(`GSTIN: ${data.sellerGstin}`, 50, 137)
    .text(`State: ${data.sellerState}`, 50, 149);

  doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold').text('BUYER (Recipient)', 300, 100);
  doc.fillColor('#333').fontSize(9).font('Helvetica')
    .text(data.buyerName, 300, 113)
    .text(data.buyerAddress, 300, 125)
    .text(data.buyerGstin ? `GSTIN: ${data.buyerGstin}` : 'Unregistered', 300, 137)
    .text(`State: ${data.buyerState}`, 300, 149);

  doc.moveTo(50, 165).lineTo(555, 165).strokeColor('#ccc').stroke();
  doc.y = 175;

  // ── Items Table ───────────────────────────────────────────────
  const colX = [50, 200, 260, 300, 340, 390, 440, 500];
  const headers = ['Description', 'HSN', 'Qty', 'Unit', 'Rate', 'Taxable', 'GST', 'Total'];

  doc.fillColor('white').rect(50, doc.y, 505, 18).fill(accentColor);
  doc.fillColor('white').fontSize(8).font('Helvetica-Bold');
  headers.forEach((h, i) => doc.text(h, colX[i], doc.y - 14, { width: 55 }));
  doc.y += 5;

  let grandTaxable = 0, grandGst = 0, grandTotal = 0;

  data.items.forEach((item, idx) => {
    const taxable = item.quantity * item.unitPrice;
    const gst = computeGST(taxable, item.gstRate, data.buyerState, data.sellerState);
    const totalGst = gst.cgst + gst.sgst + gst.igst;
    const total = taxable + totalGst;
    grandTaxable += taxable;
    grandGst += totalGst;
    grandTotal += total;

    const rowY = doc.y + 5;
    if (idx % 2 === 0) doc.rect(50, rowY - 2, 505, 16).fill('#f8f8f8');
    doc.fillColor('#333').font('Helvetica').fontSize(8);
    doc.text(item.description, colX[0], rowY, { width: 145 });
    doc.text(item.hsn, colX[1], rowY);
    doc.text(item.quantity.toString(), colX[2], rowY);
    doc.text(item.unit, colX[3], rowY);
    doc.text(`₹${item.unitPrice.toLocaleString('en-IN')}`, colX[4], rowY);
    doc.text(`₹${taxable.toLocaleString('en-IN')}`, colX[5], rowY);
    doc.text(`₹${totalGst.toLocaleString('en-IN')}`, colX[6], rowY);
    doc.text(`₹${total.toLocaleString('en-IN')}`, colX[7], rowY);
    doc.y += 18;
  });

  // ── GST Breakup ───────────────────────────────────────────────
  doc.moveTo(50, doc.y + 5).lineTo(555, doc.y + 5).strokeColor('#ccc').stroke();
  doc.y += 15;

  const summaryX = 360;
  doc.fillColor('#333').fontSize(9);

  const addRow = (label: string, value: string, bold = false) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .text(label, summaryX, doc.y)
      .text(value, 480, doc.y, { align: 'right' });
    doc.y += 14;
  };

  addRow('Taxable Amount:', `₹${grandTaxable.toLocaleString('en-IN')}`);

  if (isIntrastate) {
    const half = grandGst / 2;
    addRow('CGST:', `₹${half.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    addRow('SGST:', `₹${half.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
  } else {
    addRow('IGST:', `₹${grandGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
  }

  addRow('TCS (1%):', `₹${data.tcsAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
  addRow('Total Amount:', `₹${(grandTotal + data.tcsAmount).toLocaleString('en-IN')}`, true);

  // ── Platform Commission Note ──────────────────────────────────
  doc.y += 10;
  const commGst = computeGST(data.commissionAmount, data.commissionGstRate, data.buyerState, data.sellerState);
  const totalCommGst = commGst.cgst + commGst.sgst + commGst.igst;

  doc.rect(50, doc.y, 505, 60).fill('#f0f7f0');
  doc.fillColor(primaryColor).fontSize(9).font('Helvetica-Bold')
    .text('Platform Commission Note', 60, doc.y + 8);
  doc.fillColor('#333').font('Helvetica').fontSize(8)
    .text(`Commission: ₹${data.commissionAmount.toFixed(2)}`, 60, doc.y + 22)
    .text(`GST on Commission (${data.commissionGstRate}%): ₹${totalCommGst.toFixed(2)}`, 60, doc.y + 34)
    .text(`TCS Deducted: ₹${data.tcsAmount.toFixed(2)}`, 60, doc.y + 46)
    .text(`Net Payout to Seller: ₹${data.netPayoutToSeller.toFixed(2)}`, 300, doc.y + 22)
    .text('(T+2 business days after buyer confirmation)', 300, doc.y + 34);

  doc.y += 70;

  // ── Footer ───────────────────────────────────────────────────
  doc.moveTo(50, doc.y).lineTo(555, doc.y).strokeColor('#ccc').stroke();
  doc.y += 8;
  doc.fillColor('#888').fontSize(7).font('Helvetica')
    .text('This is a computer-generated invoice. No signature required.', 50, doc.y, { align: 'center', width: 505 })
    .text('NirmalMandi is operated by Amalthea Consultancy. Platform GSTIN: ' + data.platformGstin, 50, doc.y + 10, { align: 'center', width: 505 })
    .text(`Order Reference: ${data.orderNumber}`, 50, doc.y + 20, { align: 'center', width: 505 });
}
