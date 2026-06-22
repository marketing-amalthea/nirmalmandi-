'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Package, MapPin, BadgeCheck, ShoppingCart,
  Heart, Loader2, Shield, Megaphone, MessageCircle, FileText, ShieldAlert, Minus, Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { TopNav, Badge } from '@/components/ui';
import MarketingPanel from '@/components/MarketingPanel';
import NegotiationModal from '@/components/NegotiationModal';
import RfqModal from '@/components/RfqModal';
import api, { inventoryApi, complianceApi, aiApi } from '@/lib/api';
import { isAuthenticated, getUser } from '@/lib/auth';

const GRADE_STYLES: Record<string, [string, string]> = {
  A: ['#1f6b3a', '#e9f4ec'],
  B: ['#281f12', '#efe9dd'],
  C: ['#a9690a', '#fdeccc'],
  D: ['#b6442a', '#fbe7e2'],
};

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [calcQuantity, setCalcQuantity] = useState(1);
  const [showMarketing, setShowMarketing] = useState(false);
  const [showNegotiation, setShowNegotiation] = useState(false);
  const [showRfq, setShowRfq] = useState(false);
  const [watchlisted, setWatchlisted] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [compliance, setCompliance] = useState<{ compliant: boolean; missing: string[]; warning_message: string | null; document_labels: Record<string, string> } | null>(null);
  const [selectedImg, setSelectedImg] = useState(0);
  const [aiCaption, setAiCaption] = useState('');
  const [captionLoading, setCaptionLoading] = useState(false);

  const { data: listing, isLoading, isError } = useQuery({
    queryKey: ['listing', id],
    queryFn: () => inventoryApi.getListing(id),
    select: (res) => (res.data as unknown as { data: Record<string, unknown> })?.data ?? null,
    enabled: !!id,
  });

  useEffect(() => {
    if (!id || !isAuthenticated()) return;
    const user = getUser();
    if (user?.role !== 'buyer') return;
    complianceApi.check(id as string)
      .then(r => { const d = (r.data as { data: typeof compliance }).data; if (d && !d.compliant) setCompliance(d); })
      .catch(() => {});
  }, [id]);

  if (isLoading) return (
    <div style={{ minHeight: '100vh', background: 'var(--nm-paper)' }}>
      <TopNav />
      <div className="flex items-center justify-center" style={{ paddingTop: 120 }}>
        <Loader2 size={36} style={{ color: 'var(--nm-green)' }} className="animate-spin" />
      </div>
    </div>
  );

  if (isError || !listing) return (
    <div style={{ minHeight: '100vh', background: 'var(--nm-paper)' }}>
      <TopNav />
      <div className="flex flex-col items-center justify-center gap-4 text-center" style={{ paddingTop: 120 }}>
        <Package size={56} style={{ color: 'var(--nm-faint)' }} />
        <h2 className="disp" style={{ fontSize: 22, fontWeight: 700, color: 'var(--nm-ink)' }}>Listing not found</h2>
        <Link href="/listings" className="nm-btn-primary no-underline">Browse all listings</Link>
      </div>
    </div>
  );

  const l = listing as unknown as Record<string, unknown>;
  const pricePerUnit = Number(l.asking_price ?? l.price_per_unit ?? 0);
  const availableQty  = Number(l.available_quantity ?? l.quantity ?? 0);
  const sectorName    = String(l.sector_name ?? l.sector ?? '—');
  const sellerCity    = String(l.city ?? l.seller_city ?? '');
  const sellerState   = String(l.state ?? l.seller_state ?? '');
  const sellerLocation = [sellerCity, sellerState].filter(Boolean).join(', ');
  const listingTitle  = String(l.title ?? '');
  const listingStatus = String(l.status ?? '');
  const urgencyDays   = l.urgency_days ? Number(l.urgency_days) : 0;
  const mrp           = l.mrp ? Number(l.mrp) : null;
  const conditionGrade = l.condition_grade ? String(l.condition_grade) : null;
  const sellerName    = l.seller_business_name ? String(l.seller_business_name) : null;
  const isVerified    = ['verified','premium'].includes(String(l.seller_verification_tier ?? ''));
  const images        = Array.isArray(l.images) ? (l.images as string[]) : [];
  const moq           = l.moq ? Number(l.moq) : 1;
  const stockType     = l.stock_type ? String(l.stock_type).replace(/_/g, ' ') : '';

  const safeQty    = Math.max(moq, Math.min(availableQty || 9999, calcQuantity));
  const subtotal   = pricePerUnit * safeQty;
  const platFee    = subtotal * 0.025;
  const youPay     = subtotal + platFee;
  const savePct    = mrp && mrp > pricePerUnit ? Math.round((1 - pricePerUnit / mrp) * 100) : 0;
  const reselEst   = subtotal * 1.53;
  const marginAmt  = reselEst - subtotal;
  const marginPct  = Math.round((marginAmt / subtotal) * 100);

  const [gradeColor, gradeBg] = GRADE_STYLES[conditionGrade ?? 'B'] ?? GRADE_STYLES.B;

  async function handleWatchlist() {
    if (!isAuthenticated()) { toast.error('Login to save listings'); router.push('/login'); return; }
    setWatchlistLoading(true);
    try {
      if (watchlisted) { await api.delete(`/buyer/watchlist/${String(l.id)}`); setWatchlisted(false); toast.success('Removed from watchlist'); }
      else { await api.post('/buyer/watchlist', { listing_id: String(l.id) }); setWatchlisted(true); toast.success('Saved to watchlist'); }
    } catch { toast.error('Could not update watchlist'); } finally { setWatchlistLoading(false); }
  }

  async function generateCaption(platform: 'whatsapp' | 'instagram') {
    setCaptionLoading(true);
    try {
      const res = await aiApi.generateCaption({ listing_id: String(l.id), product_title: listingTitle, sector: sectorName, price: pricePerUnit, mrp: mrp ?? undefined, grade: conditionGrade ?? 'B', city: sellerCity, state: sellerState, language: 'hi', tone: 'urgent', platform });
      const d = (res.data as unknown as { data: { full_caption: string } }).data;
      setAiCaption(d?.full_caption ?? '');
    } catch { toast.error('Caption generation failed'); } finally { setCaptionLoading(false); }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--nm-paper)' }}>
      <TopNav />

      {/* Modals */}
      {showNegotiation && (
        <NegotiationModal listing={{ id: String(l.id ?? ''), title: listingTitle, asking_price: pricePerUnit, mrp: mrp ?? undefined, sector: sectorName, floor_price: l.floor_price ? Number(l.floor_price) : undefined }}
          onClose={() => setShowNegotiation(false)}
          onAccepted={(agreedPrice, negId) => router.push(`/checkout?listing_id=${String(l.id)}&quantity=${safeQty}&agreed_price=${agreedPrice}&negotiation_id=${negId}`)} />
      )}
      {showRfq && (
        <RfqModal listing={{ id: String(l.id ?? ''), title: listingTitle, asking_price: pricePerUnit, moq, available_quantity: availableQty }} onClose={() => setShowRfq(false)} />
      )}
      {showMarketing && (
        <MarketingPanel listing={{ id: String(l.id ?? ''), title: listingTitle, sector_name: sectorName, asking_price: pricePerUnit, mrp: mrp ?? undefined, condition_grade: conditionGrade ?? undefined, city: sellerCity, state: sellerState }} onClose={() => setShowMarketing(false)} />
      )}

      {/* Urgency bar */}
      {urgencyDays > 0 && (
        <div className="gradient-gold flex items-center justify-between px-8 py-2.5">
          <span style={{ fontSize: 13.5, fontWeight: 600, color: '#fff' }}>
            ⚡ Ageing {urgencyDays} days · seller is open to offers
          </span>
        </div>
      )}

      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '28px 28px 0' }}>
        <Link href="/listings" className="no-underline inline-flex items-center gap-1.5 mb-6" style={{ fontSize: 13.5, color: 'var(--nm-muted)', fontWeight: 600 }}>
          <ArrowLeft size={15} /> Back to listings
        </Link>

        {/* Compliance warning */}
        {compliance && !compliance.compliant && (
          <div className="flex items-start gap-3 mb-6" style={{ background: 'var(--nm-gold-soft)', border: '1px solid var(--nm-gold-line)', borderRadius: 16, padding: '14px 18px' }}>
            <ShieldAlert size={18} style={{ color: 'var(--nm-gold-ink)', flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--nm-gold-ink)', margin: 0 }}>Compliance Required</p>
              <p style={{ fontSize: 12.5, color: 'var(--nm-gold-ink)', margin: '4px 0 0', opacity: 0.85 }}>{compliance.warning_message}</p>
            </div>
          </div>
        )}

        {/* Main 2-col */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 32, alignItems: 'start' }}>

          {/* ── Left: Gallery + specs ─────────────────────────────────── */}
          <div>
            {/* Main image */}
            <div className="nm-card overflow-hidden relative" style={{ borderRadius: 18, marginBottom: 12, aspectRatio: '4/3', background: 'var(--nm-panel)' }}>
              {savePct > 0 && (
                <span className="nm-pill absolute top-3 left-3 z-10" style={{ background: 'var(--nm-gold)', color: 'var(--nm-deep)', fontWeight: 800 }}>−{savePct}%</span>
              )}
              {(listingStatus === 'flash_sale' || String(l.price_type) === 'flash_sale') && (
                <span className="nm-pill absolute top-3 right-3 z-10" style={{ background: '#b6442a', color: '#fff', fontWeight: 700 }}>🔥 Flash</span>
              )}
              {images[selectedImg] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={images[selectedImg]} alt={listingTitle} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package size={80} style={{ color: 'var(--nm-faint)' }} />
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-2 mb-6">
                {images.slice(0, 4).map((img, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={img} alt="" onClick={() => setSelectedImg(i)} className="object-cover cursor-pointer"
                    style={{ width: 72, height: 72, borderRadius: 10, border: `${selectedImg === i ? '2px solid var(--nm-green)' : '1.5px solid var(--nm-line)'}` }} />
                ))}
              </div>
            )}

            {/* Lot specs */}
            {l.attributes && typeof l.attributes === 'object' && (
              <div className="nm-card" style={{ padding: '18px 20px' }}>
                <h3 className="disp" style={{ fontSize: 14, fontWeight: 700, margin: '0 0 14px', color: 'var(--nm-ink)' }}>Lot specifications</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px' }}>
                  {Object.entries(l.attributes as unknown as Record<string, unknown>).map(([k, v]) => (
                    <div key={k}>
                      <p style={{ fontSize: 11, color: 'var(--nm-faint)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>{k}</p>
                      <p style={{ fontSize: 13.5, color: 'var(--nm-ink)', margin: '2px 0 0' }}>{String(v)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Right: Info + Calculator ──────────────────────────────── */}
          <div className="flex flex-col gap-5">
            {/* Pills */}
            <div className="flex gap-2 flex-wrap">
              <span className="nm-pill" style={{ color: 'var(--nm-green)', background: 'var(--nm-green-soft)', fontSize: 12 }}>{sectorName}</span>
              {conditionGrade && <span className="nm-pill" style={{ color: gradeColor, background: gradeBg, fontSize: 12 }}>Grade {conditionGrade}</span>}
              {isVerified && <span className="nm-pill" style={{ color: 'var(--nm-green)', background: 'var(--nm-green-soft)', fontSize: 12 }}><BadgeCheck size={12} /> Verified seller</span>}
            </div>

            {/* Title */}
            <h1 className="disp" style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2, color: 'var(--nm-ink)', margin: 0 }}>{listingTitle}</h1>

            {/* Seller */}
            <p style={{ fontSize: 13.5, color: 'var(--nm-muted)', margin: 0 }}>
              by <strong style={{ color: 'var(--nm-ink)' }}>{sellerName ?? 'Seller'}</strong>
              {sellerLocation && <span> · <MapPin size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> {sellerLocation}</span>}
            </p>

            {/* Price */}
            <div>
              <span className="num" style={{ fontSize: 44, fontWeight: 800, color: 'var(--nm-green)', fontFamily: '"Bricolage Grotesque",sans-serif', letterSpacing: '-0.02em' }}>
                ₹{pricePerUnit.toLocaleString('en-IN')}
              </span>
              <span style={{ fontSize: 13.5, color: 'var(--nm-faint)', textDecoration: 'line-through', marginLeft: 10 }}>
                {mrp ? `₹${mrp.toLocaleString('en-IN')}` : ''}
              </span>
              {mrp && <span style={{ fontSize: 13, color: 'var(--nm-muted)', marginLeft: 8 }}>Resale est. ₹{Math.round(pricePerUnit * 1.53).toLocaleString('en-IN')}</span>}
            </div>

            {/* Lot calculator */}
            <div style={{ background: 'var(--nm-gold-soft)', border: '1px solid var(--nm-gold-line)', borderRadius: 18, padding: 20 }}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="disp" style={{ fontSize: 15, fontWeight: 700, color: 'var(--nm-ink)', margin: 0 }}>Lot calculator</h3>
                <span style={{ fontSize: 12, color: 'var(--nm-gold-ink)', fontWeight: 600 }}>MOQ {moq} · Partial lot OK</span>
              </div>

              {/* Quantity stepper */}
              <div className="flex items-center gap-3 mb-4">
                <button onClick={() => setCalcQuantity(q => Math.max(moq, q - (moq || 1)))}
                  className="flex items-center justify-center" style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--nm-deep)', color: '#fff', border: 'none', cursor: 'pointer' }}>
                  <Minus size={16} />
                </button>
                <input type="number" value={calcQuantity} onChange={e => setCalcQuantity(Math.max(moq, Math.min(availableQty, Number(e.target.value) || moq)))}
                  className="text-center num" style={{ width: 80, padding: '8px', borderRadius: 10, border: '1px solid var(--nm-gold-line)', background: 'var(--nm-card)', fontSize: 18, fontWeight: 700, fontFamily: '"Bricolage Grotesque",sans-serif', outline: 'none' }} />
                <button onClick={() => setCalcQuantity(q => Math.min(availableQty, q + (moq || 1)))}
                  className="flex items-center justify-center" style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--nm-deep)', color: '#fff', border: 'none', cursor: 'pointer' }}>
                  <Plus size={16} />
                </button>
              </div>

              {/* Breakdown */}
              <div className="flex flex-col gap-2 mb-3">
                {[
                  ['Subtotal', `₹${subtotal.toLocaleString('en-IN')}`],
                  ['Platform fee 2.5%', `₹${platFee.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between" style={{ fontSize: 13.5, color: 'var(--nm-muted)' }}>
                    <span>{label}</span><span className="num" style={{ color: 'var(--nm-ink)' }}>{val}</span>
                  </div>
                ))}
                <div style={{ borderTop: '1.5px dashed var(--nm-gold-line)', margin: '4px 0' }} />
                <div className="flex justify-between" style={{ fontSize: 15, fontWeight: 700, color: 'var(--nm-ink)' }}>
                  <span>You pay</span><span className="num">₹{youPay.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                </div>
              </div>

              {/* Margin result */}
              <div style={{ background: 'var(--nm-green-soft)', borderRadius: 12, padding: '12px 16px', textAlign: 'center' }}>
                <span className="disp" style={{ fontSize: 14, fontWeight: 700, color: 'var(--nm-green)' }}>
                  Est. resale margin +₹{Math.round(marginAmt).toLocaleString('en-IN')} ≈ {marginPct}% margin
                </span>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <button onClick={() => { if (!isAuthenticated()) { router.push('/login'); return; } router.push(`/checkout?listing_id=${String(l.id)}&quantity=${safeQty}`); }}
                  disabled={listingStatus !== 'live' && listingStatus !== 'active'}
                  className="nm-btn-primary flex-1" style={{ padding: '13px', fontSize: 15 }}>
                  <ShoppingCart size={16} /> Buy now
                </button>
                <button onClick={() => { if (!isAuthenticated()) { router.push('/login'); return; } setShowNegotiation(true); }}
                  className="nm-btn-gold flex-1" style={{ padding: '13px', fontSize: 15 }}>
                  <MessageCircle size={16} /> Make offer
                </button>
                <button onClick={handleWatchlist} disabled={watchlistLoading}
                  className="flex items-center justify-center" style={{ width: 48, height: 48, borderRadius: 12, border: '1px solid var(--nm-line)', background: 'var(--nm-card)', cursor: 'pointer', flexShrink: 0 }}>
                  <Heart size={18} fill={watchlisted ? 'var(--nm-red)' : 'none'} style={{ color: watchlisted ? 'var(--nm-red)' : 'var(--nm-muted)' }} />
                </button>
              </div>
              <button onClick={() => setShowRfq(true)} className="nm-btn-secondary w-full" style={{ padding: '11px' }}>
                <FileText size={15} /> Request Bulk Quote (RFQ)
              </button>
            </div>

            {/* Quick stats */}
            <div className="flex gap-4 flex-wrap" style={{ fontSize: 13, color: 'var(--nm-muted)' }}>
              <span>{availableQty.toLocaleString('en-IN')} units available</span>
              {l.view_count && <span>· {Number(l.view_count).toLocaleString('en-IN')} watching</span>}
              {stockType && <span>· {stockType}</span>}
            </div>

            {/* Escrow box */}
            <div className="flex items-start gap-3" style={{ background: 'var(--nm-green-soft)', borderRadius: 16, padding: '16px 18px' }}>
              <span className="flex items-center justify-center flex-shrink-0" style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--nm-green)', color: '#fff' }}>
                <Shield size={18} />
              </span>
              <p style={{ fontSize: 13, color: 'var(--nm-green)', lineHeight: 1.5, margin: 0 }}>
                <strong>Escrow-protected payment</strong> — we hold your payment until you confirm the lot is received as described.
              </p>
            </div>
          </div>
        </div>

        {/* ── AI Market-it panel ───────────────────────────────────────── */}
        <div style={{ margin: '32px 0 48px', background: 'var(--nm-deep)', borderRadius: 24, padding: '36px 40px' }}>
          {/* blobs */}
          <div style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', right: -40, top: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(244,168,42,.1)', pointerEvents: 'none' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--nm-gold)', margin: '0 0 10px' }}>AI MARKET-IT</p>
                <h2 className="disp" style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: '0 0 10px', lineHeight: 1.2 }}>Won the lot? Resell it in one tap.</h2>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,.65)', margin: '0 0 20px', lineHeight: 1.5 }}>Generate a ready-to-share caption for WhatsApp or Instagram in seconds.</p>
                <div className="flex gap-3">
                  <button onClick={() => generateCaption('whatsapp')} disabled={captionLoading} className="nm-btn-gold" style={{ fontSize: 13.5 }}>
                    {captionLoading ? <Loader2 size={14} className="animate-spin" /> : '💬'} WhatsApp caption
                  </button>
                  <button onClick={() => generateCaption('instagram')} disabled={captionLoading}
                    className="flex items-center gap-2" style={{ padding: '12px 18px', borderRadius: 12, background: 'transparent', color: '#fff', border: '1.5px solid rgba(255,255,255,.3)', cursor: 'pointer', fontSize: 13.5, fontFamily: '"Bricolage Grotesque",sans-serif', fontWeight: 600 }}>
                    📸 Instagram
                  </button>
                  <button onClick={() => setShowMarketing(true)} className="flex items-center gap-2" style={{ padding: '12px 18px', borderRadius: 12, background: 'transparent', color: 'rgba(255,255,255,.65)', border: '1px solid rgba(255,255,255,.2)', cursor: 'pointer', fontSize: 13, fontFamily: '"Bricolage Grotesque",sans-serif', fontWeight: 600 }}>
                    <Megaphone size={14} /> More options
                  </button>
                </div>
              </div>
              <div style={{ background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 16, padding: 18, minHeight: 120 }}>
                {aiCaption ? (
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,.9)', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{aiCaption}</p>
                ) : (
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,.3)', fontStyle: 'italic', margin: 0 }}>Your AI-generated caption will appear here…</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
