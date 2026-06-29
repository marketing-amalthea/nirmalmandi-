'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Loader2, AlertCircle, ArrowLeft, Save, Pause, Play } from 'lucide-react';
import { toast } from 'sonner';
import { inventoryApi } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';
import { SellerAppShell, SectionCard } from '@/components/ui';

// ── Enums matching backend schema ──────────────────────────────
const DEAD_STOCK_TYPES = [
  { value: 'excess',            label: 'Overstock / Excess' },
  { value: 'near_expiry',       label: 'Near Expiry' },
  { value: 'obsolete',          label: 'Discontinued / Obsolete' },
  { value: 'seasonal',          label: 'Seasonal' },
  { value: 'returns',           label: 'Returns' },
  { value: 'damaged_packaging', label: 'Damaged Packaging' },
];

const CONDITION_GRADES = ['A', 'B', 'C', 'D'];

const LOT_TYPES = [
  { value: 'full_lot', label: 'Full lot only' },
  { value: 'partial',  label: 'Partial lots' },
  { value: 'per_unit', label: 'Per unit' },
];

const PRICE_TYPES = [
  { value: 'fixed',   label: 'Fixed price' },
  { value: 'offer',   label: 'Best offer' },
  { value: 'auction', label: 'Auction' },
  { value: 'flash',   label: 'Flash sale' },
];

const UNITS = ['pieces', 'kg', 'boxes', 'cartons', 'pallets', 'units', 'meters', 'sets', 'bags'];

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu & Kashmir', 'Ladakh',
];

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12.5, fontWeight: 600,
  color: 'var(--nm-ink)', marginBottom: 6,
};

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p style={{ fontSize: 12, color: 'var(--nm-red)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
      <AlertCircle size={12} />{msg}
    </p>
  );
}

interface EditForm {
  title: string;
  description: string;
  dead_stock_type: string;
  condition_grade: string;
  lot_type: string;
  unit: string;
  moq: string;
  price_type: string;
  asking_price: string;
  floor_price: string;
  mrp: string;
  state: string;
  city: string;
  urgency: number;
  status: string;
}

export default function EditListingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [form, setForm] = useState<EditForm | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof EditForm, string>>>({});

  useEffect(() => { if (!isAuthenticated()) router.replace('/login'); }, [router]);

  // ── Fetch existing listing ──────────────────────────────────
  const { isLoading, isError } = useQuery({
    queryKey: ['listing-edit', id],
    queryFn: () => inventoryApi.getListing(id),
    enabled: !!id && isAuthenticated(),
    select: (res) => {
      const l = (res.data as unknown as { data?: Record<string, unknown> })?.data
        ?? res.data as unknown as Record<string, unknown>;
      return l;
    },
    onSuccess: (l: Record<string, unknown>) => {
      setForm({
        title:           String(l.title ?? ''),
        description:     String(l.description ?? ''),
        dead_stock_type: String(l.dead_stock_type ?? ''),
        condition_grade: String(l.condition_grade ?? ''),
        lot_type:        String(l.lot_type ?? ''),
        unit:            String(l.unit ?? 'pieces'),
        moq:             String(l.moq ?? '1'),
        price_type:      String(l.price_type ?? 'fixed'),
        asking_price:    String(l.asking_price ?? ''),
        floor_price:     String(l.floor_price ?? ''),
        mrp:             String(l.mrp ?? ''),
        state:           String(l.state ?? ''),
        city:            String(l.city ?? ''),
        urgency:         Number(l.urgency_score ?? 3),
        status:          String(l.status ?? 'live'),
      });
    },
  } as Parameters<typeof useQuery>[0]);

  // ── Save mutation ──────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      inventoryApi.updateListing(id, payload as Parameters<typeof inventoryApi.updateListing>[1]),
    onSuccess: () => {
      toast.success('Listing updated!');
      router.push('/seller/listings');
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err?.response?.data?.error ?? 'Failed to update listing');
    },
  });

  function set(field: keyof EditForm, value: string | number) {
    setForm(f => f ? { ...f, [field]: value } : f);
    setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  }

  function validate(): boolean {
    if (!form) return false;
    const errs: typeof errors = {};
    if (!form.title.trim() || form.title.trim().length < 5) errs.title = 'Title must be at least 5 characters';
    if (!form.asking_price || Number(form.asking_price) <= 0) errs.asking_price = 'Enter a valid asking price';
    if (!form.state) errs.state = 'State is required';
    if (!form.city.trim()) errs.city = 'City is required';
    setErrors(errs);
    if (Object.keys(errs).length) toast.error('Fix the highlighted fields');
    return Object.keys(errs).length === 0;
  }

  function handleSave() {
    if (!validate() || !form) return;
    const payload: Record<string, unknown> = {
      title:           form.title.trim(),
      description:     form.description.trim() || undefined,
      dead_stock_type: form.dead_stock_type || undefined,
      condition_grade: form.condition_grade || undefined,
      lot_type:        form.lot_type || undefined,
      unit:            form.unit,
      moq:             form.moq ? Number(form.moq) : undefined,
      price_type:      form.price_type,
      asking_price:    Number(form.asking_price),
      floor_price:     form.floor_price ? Number(form.floor_price) : undefined,
      mrp:             form.mrp ? Number(form.mrp) : undefined,
      state:           form.state,
      city:            form.city.trim(),
      urgency_days:    form.urgency >= 4 ? form.urgency * 7 : undefined,
    };
    mutation.mutate(payload);
  }

  function toggleStatus() {
    if (!form) return;
    const newStatus = form.status === 'live' ? 'paused' : 'live';
    set('status', newStatus);
    inventoryApi.updateListing(id, { status: newStatus })
      .then(() => toast.success(newStatus === 'live' ? 'Listing is live' : 'Listing paused'))
      .catch(() => { set('status', form.status); toast.error('Failed to update status'); });
  }

  if (isLoading || !form) {
    return (
      <SellerAppShell title="Edit listing">
        <div className="flex items-center justify-center py-24">
          <Loader2 size={32} className="animate-spin" style={{ color: 'var(--nm-green)' }} />
        </div>
      </SellerAppShell>
    );
  }

  if (isError) {
    return (
      <SellerAppShell title="Edit listing">
        <div className="flex flex-col items-center gap-4 py-24">
          <AlertCircle size={32} style={{ color: 'var(--nm-red)' }} />
          <p style={{ color: 'var(--nm-muted)' }}>Listing not found or you don&apos;t have access.</p>
          <button onClick={() => router.push('/seller/listings')} className="nm-btn-secondary">
            Back to listings
          </button>
        </div>
      </SellerAppShell>
    );
  }

  return (
    <SellerAppShell
      title="Edit listing"
      subtitle="Update your listing details"
      actions={
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/seller/listings')} className="nm-btn-secondary"
            style={{ fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <ArrowLeft size={14} /> Back
          </button>
          <button onClick={toggleStatus}
            className={form.status === 'live' ? 'nm-btn-secondary' : 'nm-btn-secondary'}
            style={{ fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 5,
              color: form.status === 'live' ? 'var(--nm-gold-ink)' : 'var(--nm-green)',
              borderColor: form.status === 'live' ? 'var(--nm-gold)' : 'var(--nm-green)' }}>
            {form.status === 'live' ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Go live</>}
          </button>
          <button onClick={handleSave} disabled={mutation.isPending} className="nm-btn-primary"
            style={{ fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            {mutation.isPending ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Save size={14} /> Save changes</>}
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left — main fields */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          <SectionCard title="Basics">
            <div className="flex flex-col gap-4">
              <div>
                <label style={labelStyle}>Title *</label>
                <input value={form.title} onChange={e => set('title', e.target.value)}
                  className="nm-input" style={{ width: '100%' }} maxLength={500}
                  placeholder="e.g. 500 units Nike T-shirts — Overstock clearance" />
                <FieldError msg={errors.title} />
              </div>
              <div>
                <label style={labelStyle}>Description</label>
                <textarea value={form.description} onChange={e => set('description', e.target.value)}
                  rows={4} maxLength={2000} className="nm-input"
                  style={{ width: '100%', resize: 'none' }}
                  placeholder="Describe the product, condition, packaging, reason for sale…" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label style={labelStyle}>Stock type</label>
                  <select value={form.dead_stock_type} onChange={e => set('dead_stock_type', e.target.value)} className="nm-select" style={{ width: '100%' }}>
                    <option value="">Select type…</option>
                    {DEAD_STOCK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Price type</label>
                  <select value={form.price_type} onChange={e => set('price_type', e.target.value)} className="nm-select" style={{ width: '100%' }}>
                    {PRICE_TYPES.map(pt => <option key={pt.value} value={pt.value}>{pt.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Pricing">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label style={labelStyle}>Asking price (₹) *</label>
                <input type="number" value={form.asking_price} onChange={e => set('asking_price', e.target.value)}
                  className="nm-input" style={{ width: '100%' }} min="1" />
                <FieldError msg={errors.asking_price} />
              </div>
              <div>
                <label style={labelStyle}>Floor price (₹)</label>
                <input type="number" value={form.floor_price} onChange={e => set('floor_price', e.target.value)}
                  className="nm-input" style={{ width: '100%' }} min="0" />
              </div>
              <div>
                <label style={labelStyle}>MRP (₹)</label>
                <input type="number" value={form.mrp} onChange={e => set('mrp', e.target.value)}
                  className="nm-input" style={{ width: '100%' }} min="0" />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Stock details">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label style={labelStyle}>Condition grade</label>
                <div className="flex gap-2">
                  {CONDITION_GRADES.map(g => (
                    <button key={g} type="button" onClick={() => set('condition_grade', g)}
                      style={{
                        padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        border: `1.5px solid ${form.condition_grade === g ? 'var(--nm-green)' : 'var(--nm-line)'}`,
                        background: form.condition_grade === g ? 'var(--nm-green-soft)' : 'var(--nm-card)',
                        color: form.condition_grade === g ? 'var(--nm-green)' : 'var(--nm-muted)',
                      }}>
                      {g}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Lot type</label>
                <select value={form.lot_type} onChange={e => set('lot_type', e.target.value)} className="nm-select" style={{ width: '100%' }}>
                  <option value="">Select…</option>
                  {LOT_TYPES.map(lt => <option key={lt.value} value={lt.value}>{lt.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Unit</label>
                <select value={form.unit} onChange={e => set('unit', e.target.value)} className="nm-select" style={{ width: '100%' }}>
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <label style={labelStyle}>MOQ (min order quantity)</label>
              <input type="number" value={form.moq} onChange={e => set('moq', e.target.value)}
                className="nm-input" style={{ maxWidth: 160 }} min="1" />
            </div>
          </SectionCard>
        </div>

        {/* Right — location + urgency + status */}
        <div className="flex flex-col gap-5">
          <SectionCard title="Location">
            <div className="flex flex-col gap-3">
              <div>
                <label style={labelStyle}>State *</label>
                <select value={form.state} onChange={e => set('state', e.target.value)} className="nm-select" style={{ width: '100%' }}>
                  <option value="">Select state…</option>
                  {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <FieldError msg={errors.state} />
              </div>
              <div>
                <label style={labelStyle}>City *</label>
                <input value={form.city} onChange={e => set('city', e.target.value)}
                  className="nm-input" style={{ width: '100%' }} placeholder="City" />
                <FieldError msg={errors.city} />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Urgency">
            <div className="flex items-center gap-2 mb-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} type="button" onClick={() => set('urgency', n)}
                  style={{
                    width: 44, height: 44, borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: 'pointer',
                    border: `1.5px solid ${form.urgency === n ? 'var(--nm-gold)' : 'var(--nm-line)'}`,
                    background: form.urgency === n ? 'var(--nm-gold)' : 'var(--nm-card)',
                    color: form.urgency === n ? '#fff' : 'var(--nm-muted)',
                  }}>
                  {n}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 12, color: 'var(--nm-muted)' }}>
              {form.urgency >= 4 ? '🔥 High urgency — boosted placement' : form.urgency >= 3 ? 'Moderate — featured in feed' : 'Low — standard listing'}
            </p>
          </SectionCard>

          {/* Status card */}
          <div className="nm-card" style={{ padding: 18 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--nm-ink)', marginBottom: 10 }}>Listing status</p>
            <div className="flex items-center gap-3">
              <span className="nm-pill" style={{
                background: form.status === 'live' ? 'var(--nm-green-soft)' : 'var(--nm-gold-soft)',
                color: form.status === 'live' ? 'var(--nm-green)' : 'var(--nm-gold-ink)',
                fontWeight: 700, fontSize: 12,
              }}>
                {form.status === 'live' ? '● Live' : '⏸ Paused'}
              </span>
              <span style={{ fontSize: 12, color: 'var(--nm-muted)' }}>
                {form.status === 'live' ? 'Visible to buyers' : 'Hidden from marketplace'}
              </span>
            </div>
            <button onClick={toggleStatus} style={{ marginTop: 12, width: '100%' }}
              className={form.status === 'live' ? 'nm-btn-secondary' : 'nm-btn-primary'}>
              {form.status === 'live' ? 'Pause listing' : 'Go live'}
            </button>
          </div>
        </div>
      </div>
    </SellerAppShell>
  );
}
