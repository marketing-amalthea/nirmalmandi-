'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Store, ExternalLink, ToggleLeft, ToggleRight, CheckCircle, Pencil, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import api, { storefrontApi } from '@/lib/api';
import { getUser, isAuthenticated } from '@/lib/auth';
import type { AuthUser } from '@/lib/auth';
import { AppShell, Avatar } from '@/components/ui';
import { SELLER_NAV, SELLER_BRAND_SUB, SellerSidebarFooter } from '../_nav';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu & Kashmir', 'Ladakh',
];

const LANGUAGES = ['English', 'Hindi', 'Tamil', 'Telugu', 'Kannada', 'Marathi', 'Bengali', 'Gujarati'];
const BUSINESS_TYPES = ['manufacturer', 'distributor', 'retailer', 'wholesaler'];

interface SellerProfile {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  business_name: string;
  business_type: string;
  gst_number: string;
  pan_number?: string;
  msme_number?: string;
  state: string;
  city: string;
  address_line1?: string;
  pincode?: string;
  bank_account_last4?: string;
  ifsc?: string;
  language_preference?: string;
  kyc_status: string;
  seller_tier: string;
  total_listings: number;
  total_orders: number;
  rating?: number;
  created_at: string;
}

function fmtDate(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'S';
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="num disp" style={{ fontSize: 20, fontWeight: 800, color: 'var(--nm-ink)', margin: 0 }}>{value}</p>
      <p style={{ fontSize: 11.5, color: 'var(--nm-muted)', margin: '2px 0 0' }}>{label}</p>
    </div>
  );
}

// ── Field row — shows value or input depending on edit mode ─────────────────
function Field({ label, value, editing, children, mono }: {
  label: string; value: string; editing: boolean; children?: React.ReactNode; mono?: boolean;
}) {
  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid var(--nm-line-soft)' }}>
      <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--nm-muted)', marginBottom: editing ? 4 : 2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </label>
      {editing
        ? children
        : <span className={mono ? 'num' : ''} style={{ fontSize: 13.5, fontWeight: 600, color: value && value !== '—' ? 'var(--nm-ink)' : 'var(--nm-faint)' }}>
            {value || '—'}
          </span>
      }
    </div>
  );
}

export default function SellerProfilePage() {
  const qc = useQueryClient();
  const [localUser, setLocalUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<SellerProfile>>({});

  useEffect(() => { setReady(true); setLocalUser(getUser()); }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['seller-profile'],
    queryFn: () => api.get('/profile/me'),
    select: (res) => {
      const d = (res.data as unknown as { data?: { name?: string; email?: string; phone?: string; profile?: Partial<SellerProfile> } })?.data;
      if (!d) return undefined as unknown as SellerProfile;
      return { ...d.profile, name: d.name, email: d.email, phone: d.phone } as SellerProfile;
    },
    enabled: ready && isAuthenticated(),
  });

  const profile = data as SellerProfile | undefined;

  function startEdit() {
    setForm({
      name: profile?.name ?? '',
      business_name: profile?.business_name ?? '',
      business_type: profile?.business_type ?? '',
      gst_number: profile?.gst_number ?? '',
      pan_number: profile?.pan_number ?? '',
      msme_number: profile?.msme_number ?? '',
      state: profile?.state ?? '',
      city: profile?.city ?? '',
      address_line1: profile?.address_line1 ?? '',
      pincode: profile?.pincode ?? '',
      language_preference: profile?.language_preference ?? 'English',
    });
    setEditing(true);
  }

  const mutation = useMutation({
    mutationFn: (payload: Partial<SellerProfile>) => api.patch('/profile/me', payload),
    onSuccess: () => {
      toast.success('Profile updated');
      qc.invalidateQueries({ queryKey: ['seller-profile'] });
      setEditing(false);
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err?.response?.data?.error ?? 'Failed to update profile');
    },
  });

  function set(field: keyof SellerProfile, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  const name = (editing ? form.name : profile?.name) ?? localUser?.name ?? '—';
  const businessName = (editing ? form.business_name : profile?.business_name) ?? 'Your business';
  const kycVerified = (profile?.kyc_status ?? '') === 'approved' || (profile?.kyc_status ?? '') === 'verified';

  return (
    <AppShell
      navItems={SELLER_NAV}
      brandSub={SELLER_BRAND_SUB}
      sidebarFooter={<SellerSidebarFooter />}
      title="Profile"
      subtitle="Your seller account"
      actions={
        <div className="flex items-center gap-3">
          {editing ? (
            <>
              <button onClick={() => setEditing(false)} className="nm-btn-secondary" style={{ fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <X size={14} /> Cancel
              </button>
              <button
                onClick={() => mutation.mutate(form)}
                disabled={mutation.isPending}
                className="nm-btn-primary"
                style={{ fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                {mutation.isPending ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Save size={14} /> Save changes</>}
              </button>
            </>
          ) : (
            <button onClick={startEdit} className="nm-btn-secondary" style={{ fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Pencil size={14} /> Edit profile
            </button>
          )}
        </div>
      }
    >
      {!ready || isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 size={30} className="animate-spin" style={{ color: 'var(--nm-green)' }} /></div>
      ) : (
        <div className="flex flex-col gap-5" style={{ maxWidth: 900 }}>

          {/* Header card */}
          <div className="nm-card flex flex-wrap items-center gap-5" style={{ padding: 24 }}>
            <Avatar initials={initials(businessName)} size={72} />
            <div className="flex-1 min-w-0">
              {editing ? (
                <input
                  value={form.name ?? ''}
                  onChange={e => set('name', e.target.value)}
                  className="nm-input disp"
                  style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}
                  placeholder="Your name"
                />
              ) : (
                <h2 className="disp" style={{ fontSize: 22, fontWeight: 800, color: 'var(--nm-ink)', margin: 0 }}>{businessName}</h2>
              )}
              <p style={{ fontSize: 13, color: 'var(--nm-muted)', margin: '2px 0 10px' }}>
                {name} · Member since {fmtDate(profile?.created_at ?? '')}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="nm-pill" style={{ color: kycVerified ? 'var(--nm-green)' : 'var(--nm-gold-ink)', background: kycVerified ? 'var(--nm-green-soft)' : 'var(--nm-gold-soft)', fontWeight: 700, textTransform: 'capitalize' }}>
                  KYC {profile?.kyc_status ?? 'pending'}
                </span>
                {profile?.seller_tier && (
                  <span className="nm-pill" style={{ color: 'var(--nm-green)', background: 'var(--nm-green-soft)', fontWeight: 700, textTransform: 'capitalize' }}>{profile.seller_tier} seller</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-6">
              <Stat label="Listings" value={String(profile?.total_listings ?? 0)} />
              <Stat label="Orders" value={String(profile?.total_orders ?? 0)} />
              <Stat label="Rating" value={profile?.rating ? profile.rating.toFixed(1) : '—'} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Business details */}
            <div className="nm-card" style={{ padding: 22 }}>
              <h3 className="disp" style={{ fontSize: 15, fontWeight: 700, color: 'var(--nm-ink)', margin: '0 0 4px' }}>Business details</h3>

              <Field label="Business name" value={profile?.business_name ?? ''} editing={editing}>
                <input value={form.business_name ?? ''} onChange={e => set('business_name', e.target.value)} className="nm-input" placeholder="Your business name" />
              </Field>

              <Field label="Business type" value={profile?.business_type ?? ''} editing={editing}>
                <select value={form.business_type ?? ''} onChange={e => set('business_type', e.target.value)} className="nm-select">
                  <option value="">Select type</option>
                  {BUSINESS_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </Field>

              <Field label="GSTIN" value={profile?.gst_number ?? ''} editing={editing} mono>
                <input value={form.gst_number ?? ''} onChange={e => set('gst_number', e.target.value.toUpperCase())} className="nm-input num" placeholder="27AABCA1234A1Z5" maxLength={15} />
              </Field>

              <Field label="PAN" value={profile?.pan_number ? `••••${profile.pan_number.slice(-4)}` : ''} editing={editing} mono>
                <input value={form.pan_number ?? ''} onChange={e => set('pan_number', e.target.value.toUpperCase())} className="nm-input num" placeholder="AABCA1234A" maxLength={10} />
              </Field>

              <Field label="MSME number" value={profile?.msme_number ?? ''} editing={editing} mono>
                <input value={form.msme_number ?? ''} onChange={e => set('msme_number', e.target.value)} className="nm-input num" placeholder="UDYAM-XX-00-0000000" />
              </Field>

              <Field label="Language" value={profile?.language_preference ?? 'English'} editing={editing}>
                <select value={form.language_preference ?? 'English'} onChange={e => set('language_preference', e.target.value)} className="nm-select">
                  {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </Field>
            </div>

            {/* Location & contact */}
            <div className="nm-card" style={{ padding: 22 }}>
              <h3 className="disp" style={{ fontSize: 15, fontWeight: 700, color: 'var(--nm-ink)', margin: '0 0 4px' }}>Location & contact</h3>

              <Field label="State" value={profile?.state ?? ''} editing={editing}>
                <select value={form.state ?? ''} onChange={e => set('state', e.target.value)} className="nm-select">
                  <option value="">Select state</option>
                  {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>

              <Field label="City" value={profile?.city ?? ''} editing={editing}>
                <input value={form.city ?? ''} onChange={e => set('city', e.target.value)} className="nm-input" placeholder="Mumbai" />
              </Field>

              <Field label="Address" value={profile?.address_line1 ?? ''} editing={editing}>
                <input value={form.address_line1 ?? ''} onChange={e => set('address_line1', e.target.value)} className="nm-input" placeholder="Warehouse / office address" />
              </Field>

              <Field label="Pincode" value={profile?.pincode ?? ''} editing={editing} mono>
                <input value={form.pincode ?? ''} onChange={e => set('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))} className="nm-input num" placeholder="400001" inputMode="numeric" />
              </Field>

              <Field label="Phone" value={profile?.phone ?? localUser?.phone ?? ''} editing={false}>
                {null}
              </Field>

              <Field label="Email" value={(profile as unknown as { email?: string })?.email ?? ''} editing={false}>
                {null}
              </Field>
            </div>
          </div>

          {/* Bank details — read only with note */}
          <div className="nm-card" style={{ padding: 22 }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
              <h3 className="disp" style={{ fontSize: 15, fontWeight: 700, color: 'var(--nm-ink)', margin: 0 }}>Bank account</h3>
              <span className="nm-pill" style={{ fontSize: 11, background: 'var(--nm-gold-soft)', color: 'var(--nm-gold-ink)', fontWeight: 700 }}>Contact support to update</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Account (last 4)" value={profile?.bank_account_last4 ? `••••••${profile.bank_account_last4}` : 'Not added'} editing={false}>{null}</Field>
              <Field label="IFSC" value={profile?.ifsc ?? 'Not added'} editing={false} mono>{null}</Field>
            </div>
            <p style={{ fontSize: 12, color: 'var(--nm-faint)', marginTop: 8 }}>
              Bank details are encrypted and used only for payout processing. Email support@nirmalmandi.com to update.
            </p>
          </div>

          {/* Storefront Settings */}
          <StorefrontSettings />
        </div>
      )}
    </AppShell>
  );
}

function StorefrontSettings() {
  const [settings, setSettings] = useState<{
    seller_slug: string; storefront_enabled: boolean;
    storefront_tagline: string; reseller_margin_pct: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    storefrontApi.getMySettings()
      .then(r => {
        const d = (r.data as { data: typeof settings }).data;
        setSettings({
          seller_slug: d?.seller_slug ?? '',
          storefront_enabled: d?.storefront_enabled ?? false,
          storefront_tagline: d?.storefront_tagline ?? '',
          reseller_margin_pct: d?.reseller_margin_pct ?? 0,
        });
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      await storefrontApi.updateSettings({
        seller_slug: settings.seller_slug || undefined,
        storefront_enabled: settings.storefront_enabled,
        storefront_tagline: settings.storefront_tagline || undefined,
        reseller_margin_pct: settings.reseller_margin_pct,
      });
      toast.success('Storefront settings saved');
    } catch { toast.error('Failed to save storefront settings'); }
    finally { setSaving(false); }
  }

  if (!loaded || !settings) return null;

  const storefrontUrl = settings.seller_slug
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/s/${settings.seller_slug}`
    : null;

  return (
    <div className="nm-card" style={{ padding: 22 }}>
      <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
        <Store size={18} style={{ color: 'var(--nm-green)' }} />
        <h3 className="disp" style={{ fontSize: 15, fontWeight: 700, color: 'var(--nm-ink)', margin: 0 }}>Reseller Storefront</h3>
      </div>

      <div className="flex items-center justify-between" style={{ padding: '12px 0', borderBottom: '1px solid var(--nm-line)' }}>
        <div>
          <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--nm-ink)', margin: 0 }}>Enable Storefront</p>
          <p style={{ fontSize: 12, color: 'var(--nm-muted)', margin: 0 }}>Make your catalogue publicly accessible</p>
        </div>
        <button onClick={() => setSettings(s => s ? { ...s, storefront_enabled: !s.storefront_enabled } : s)}>
          {settings.storefront_enabled
            ? <ToggleRight size={32} style={{ color: 'var(--nm-green)' }} />
            : <ToggleLeft size={32} style={{ color: 'var(--nm-faint)' }} />}
        </button>
      </div>

      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label className="nm-label">Storefront URL slug</label>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 13, color: 'var(--nm-muted)' }}>/s/</span>
            <input value={settings.seller_slug}
              onChange={e => setSettings(s => s ? { ...s, seller_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') } : s)}
              placeholder="your-shop-name" className="nm-input flex-1" />
          </div>
          {storefrontUrl && (
            <a href={storefrontUrl} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1"
              style={{ fontSize: 12, color: 'var(--nm-green)', marginTop: 6, textDecoration: 'none' }}>
              <ExternalLink size={13} /> Preview storefront
            </a>
          )}
        </div>

        <div>
          <label className="nm-label">Tagline</label>
          <input value={settings.storefront_tagline}
            onChange={e => setSettings(s => s ? { ...s, storefront_tagline: e.target.value } : s)}
            maxLength={200} placeholder="Best deals on surplus stock — pan India" className="nm-input" />
        </div>

        <div>
          <label className="nm-label">Reseller margin: <strong>{settings.reseller_margin_pct}%</strong></label>
          <input type="range" min={0} max={50} step={0.5}
            value={settings.reseller_margin_pct}
            onChange={e => setSettings(s => s ? { ...s, reseller_margin_pct: parseFloat(e.target.value) } : s)}
            style={{ width: '100%', accentColor: 'var(--nm-green)' }}
          />
          <p style={{ fontSize: 11.5, color: 'var(--nm-muted)', marginTop: 4 }}>Prices on your storefront will be marked up by this %</p>
        </div>

        <button onClick={save} disabled={saving} className="nm-btn-primary" style={{ fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><CheckCircle size={14} /> Save storefront settings</>}
        </button>
      </div>
    </div>
  );
}
