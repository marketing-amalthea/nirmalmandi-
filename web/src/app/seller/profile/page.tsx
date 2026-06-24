'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Store, ExternalLink, ToggleLeft, ToggleRight, CheckCircle, Circle, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import api, { storefrontApi } from '@/lib/api';
import { getUser, isAuthenticated } from '@/lib/auth';
import type { AuthUser } from '@/lib/auth';
import { AppShell, Avatar } from '@/components/ui';
import { SELLER_NAV, SELLER_BRAND_SUB, SellerSidebarFooter } from '../_nav';

interface SellerProfile {
  id: string;
  name: string;
  phone: string;
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

// ── Detail row ──────────────────────────────────────────────────────────────────
function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between" style={{ padding: '11px 0', borderBottom: '1px solid var(--nm-line-soft)' }}>
      <span style={{ fontSize: 13, color: 'var(--nm-muted)' }}>{label}</span>
      <span className={mono ? 'num' : 'disp'} style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--nm-ink)' }}>{value}</span>
    </div>
  );
}

// ── Stat ────────────────────────────────────────────────────────────────────────
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="num disp" style={{ fontSize: 20, fontWeight: 800, color: 'var(--nm-ink)', margin: 0 }}>{value}</p>
      <p style={{ fontSize: 11.5, color: 'var(--nm-muted)', margin: '2px 0 0' }}>{label}</p>
    </div>
  );
}

export default function SellerProfilePage() {
  const [localUser, setLocalUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => { setReady(true); setLocalUser(getUser()); }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ['seller-profile'],
    queryFn: () => api.get('/profile/me'),
    select: (res) => {
      const d = (res.data as unknown as { data?: { name?: string; email?: string; phone?: string; profile?: Partial<SellerProfile> } })?.data;
      if (!d) return undefined as unknown as SellerProfile;
      return { ...d.profile, name: d.name, email: d.email, phone: d.phone } as SellerProfile;
    },
    enabled: ready && isAuthenticated(),
    retry: 1,
  });

  useEffect(() => { if (error) toast.error('Failed to load profile'); }, [error]);

  const profile = data as SellerProfile | undefined;
  const name = profile?.name ?? localUser?.name ?? '—';
  const businessName = profile?.business_name ?? 'Your business';
  const kycVerified = (profile?.kyc_status ?? '') === 'verified';

  return (
    <AppShell
      navItems={SELLER_NAV}
      brandSub={SELLER_BRAND_SUB}
      sidebarFooter={<SellerSidebarFooter />}
      title="Profile"
      subtitle="Your seller account details"
      actions={<button className="nm-btn-secondary" style={{ fontSize: 13.5 }}>Edit</button>}
    >
      {!ready || isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 size={30} className="animate-spin" style={{ color: 'var(--nm-green)' }} /></div>
      ) : (
        <div className="flex flex-col gap-5" style={{ maxWidth: 900 }}>
          {/* Profile header card */}
          <div className="nm-card flex flex-wrap items-center gap-5" style={{ padding: 24 }}>
            <Avatar initials={initials(businessName)} size={72} />
            <div className="flex-1 min-w-0">
              <h2 className="disp" style={{ fontSize: 22, fontWeight: 800, color: 'var(--nm-ink)', margin: 0 }}>{businessName}</h2>
              <p style={{ fontSize: 13, color: 'var(--nm-muted)', margin: '2px 0 10px' }}>
                {name} · Member since {fmtDate(profile?.created_at ?? '')}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {kycVerified && (
                  <span className="nm-pill" style={{ color: 'var(--nm-green)', background: 'var(--nm-green-soft)', fontWeight: 700 }}>KYC verified</span>
                )}
                {!kycVerified && profile?.kyc_status && (
                  <span className="nm-pill" style={{ color: 'var(--nm-gold-ink)', background: 'var(--nm-gold-soft)', fontWeight: 700, textTransform: 'capitalize' }}>KYC {profile.kyc_status}</span>
                )}
                {profile?.seller_tier && (
                  <span className="nm-pill" style={{ color: 'var(--nm-green)', background: 'var(--nm-green-soft)', fontWeight: 700, textTransform: 'capitalize' }}>{profile.seller_tier} seller</span>
                )}
                {profile?.msme_number && (
                  <span className="nm-pill" style={{ color: 'var(--nm-gold-ink)', background: 'var(--nm-gold-soft)', fontWeight: 700 }}>MSME</span>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-6" style={{ paddingLeft: 8 }}>
              <Stat label="Listings" value={String(profile?.total_listings ?? 0)} />
              <Stat label="Orders" value={String(profile?.total_orders ?? 0)} />
              <Stat label="Rating" value={profile?.rating ? profile.rating.toFixed(1) : '—'} />
            </div>
          </div>

          {/* Two columns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Business details */}
            <div className="nm-card" style={{ padding: 22 }}>
              <h3 className="disp" style={{ fontSize: 16, fontWeight: 700, color: 'var(--nm-ink)', margin: '0 0 6px' }}>Business details</h3>
              <Row label="Phone" value={profile?.phone ?? localUser?.phone ?? '—'} />
              <Row label="Business type" value={(profile?.business_type ?? '—').replace(/^./, (c) => c.toUpperCase())} />
              <Row label="GSTIN" value={profile?.gst_number ?? '—'} mono />
              <Row label="PAN" value={profile?.pan_number ? `••••${profile.pan_number.slice(-4)}` : '—'} mono />
              <div className="flex items-center justify-between" style={{ padding: '11px 0' }}>
                <span style={{ fontSize: 13, color: 'var(--nm-muted)' }}>MSME</span>
                <span className="num" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--nm-ink)' }}>{profile?.msme_number ?? '—'}</span>
              </div>
            </div>

            {/* Location & bank */}
            <div className="nm-card" style={{ padding: 22 }}>
              <h3 className="disp" style={{ fontSize: 16, fontWeight: 700, color: 'var(--nm-ink)', margin: '0 0 6px' }}>Location &amp; bank</h3>
              <Row label="State" value={profile?.state ?? '—'} />
              <Row label="City" value={profile?.city ?? '—'} />
              <Row label="Address" value={profile?.address_line1 ?? '—'} />
              <Row label="Bank" value={profile?.bank_account_last4 ? `••${profile.bank_account_last4}` : '—'} mono />
              <div className="flex items-center justify-between" style={{ padding: '11px 0' }}>
                <span style={{ fontSize: 13, color: 'var(--nm-muted)' }}>IFSC</span>
                <span className="num" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--nm-ink)' }}>{profile?.ifsc ?? '—'}</span>
              </div>
            </div>
          </div>

          {/* Onboarding progress */}
          <SellerOnboarding profile={profile} />

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
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err?.response?.data?.error ?? 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  if (!loaded || !settings) return null;

  const storefrontUrl = settings.seller_slug
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/s/${settings.seller_slug}`
    : null;

  return (
    <div className="nm-card p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Store className="w-5 h-5 text-nm-primary" />
        <h2 className="text-base font-bold text-nm-text dark:text-nm-text-dark">Reseller Storefront</h2>
      </div>
      <p className="text-sm text-nm-text-muted dark:text-nm-text-dark-muted">
        Your personal mini-catalogue — share a link and buyers can browse all your live listings with your custom margin.
      </p>

      {/* Enable toggle */}
      <div className="flex items-center justify-between py-3 border-b border-nm-border dark:border-nm-border-dark">
        <div>
          <p className="text-sm font-semibold text-nm-text dark:text-nm-text-dark">Enable Storefront</p>
          <p className="text-xs text-nm-text-muted dark:text-nm-text-dark-muted">Make your catalogue publicly accessible</p>
        </div>
        <button onClick={() => setSettings(s => s ? { ...s, storefront_enabled: !s.storefront_enabled } : s)}
          className="text-nm-primary">
          {settings.storefront_enabled
            ? <ToggleRight className="w-8 h-8" />
            : <ToggleLeft className="w-8 h-8 text-gray-400" />}
        </button>
      </div>

      {/* Slug */}
      <div>
        <label className="block text-xs font-semibold text-nm-text-muted uppercase tracking-wider mb-1.5">
          Storefront URL
        </label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-nm-text-muted flex-shrink-0">/s/</span>
          <input value={settings.seller_slug}
            onChange={e => setSettings(s => s ? { ...s, seller_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') } : s)}
            placeholder="your-shop-name"
            className="nm-input flex-1 text-sm"
          />
        </div>
        {storefrontUrl && (
          <a href={storefrontUrl} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-nm-primary mt-1.5 hover:underline">
            <ExternalLink className="w-3.5 h-3.5" /> Preview storefront
          </a>
        )}
      </div>

      {/* Tagline */}
      <div>
        <label className="block text-xs font-semibold text-nm-text-muted uppercase tracking-wider mb-1.5">
          Tagline <span className="font-normal text-nm-text-muted">(optional)</span>
        </label>
        <input value={settings.storefront_tagline}
          onChange={e => setSettings(s => s ? { ...s, storefront_tagline: e.target.value } : s)}
          maxLength={200}
          placeholder="Best deals on surplus stock — pan India"
          className="nm-input text-sm"
        />
      </div>

      {/* Reseller margin */}
      <div>
        <label className="block text-xs font-semibold text-nm-text-muted uppercase tracking-wider mb-1.5">
          Reseller Margin %
        </label>
        <div className="flex items-center gap-3">
          <input type="range" min={0} max={50} step={0.5}
            value={settings.reseller_margin_pct}
            onChange={e => setSettings(s => s ? { ...s, reseller_margin_pct: parseFloat(e.target.value) } : s)}
            className="flex-1 accent-nm-primary"
          />
          <span className="text-base font-bold text-nm-primary w-14 text-right">
            {settings.reseller_margin_pct}%
          </span>
        </div>
        <p className="text-xs text-nm-text-muted dark:text-nm-text-dark-muted mt-1">
          Prices on your storefront will be marked up by this percentage. Buyers see the higher price; you earn the margin.
        </p>
      </div>

      <button onClick={save} disabled={saving}
        className="nm-btn-seller w-full flex items-center justify-center gap-2 py-3 font-bold">
        {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</>
          : <><Store className="w-4 h-4" />Save Storefront Settings</>}
      </button>
    </div>
  );
}

// ── Seller Onboarding Progress ───────────────────────────────────────────────

interface SellerOnboardingProps { profile?: { business_name?: string; gst_number?: string; bank_account_last4?: string; kyc_status?: string } }

function SellerOnboarding({ profile }: SellerOnboardingProps) {
  const [open, setOpen] = useState<number | null>(null);
  const [form, setForm] = useState({ business_name: '', business_type: '', state: '', city: '', gst_number: '', pan_number: '', account_number: '', ifsc: '', account_holder: '' });
  const [saving, setSaving] = useState(false);

  const steps = [
    { label: 'Business details', desc: 'Name, type, city & state', done: !!(profile?.business_name && profile.business_name !== profile?.business_name?.split('@')[0]) },
    { label: 'GST & PAN', desc: 'Tax identification for invoices', done: !!profile?.gst_number },
    { label: 'Bank account', desc: 'For receiving payouts', done: !!profile?.bank_account_last4 },
  ];
  const completedCount = steps.filter(s => s.done).length;
  const allDone = completedCount === 3;

  if (allDone) return null;

  async function saveStep(stepIndex: number) {
    setSaving(true);
    try {
      const payload: Record<string, string> = {};
      if (stepIndex === 0) Object.assign(payload, { business_name: form.business_name, business_type: form.business_type, state: form.state, city: form.city });
      if (stepIndex === 1) Object.assign(payload, { gst_number: form.gst_number, pan_number: form.pan_number });
      if (stepIndex === 2) Object.assign(payload, { account_number: form.account_number, ifsc: form.ifsc, account_holder_name: form.account_holder });
      await api.patch('/seller/profile', payload);
      toast.success('Saved! Refresh to see updated status.');
      setOpen(null);
    } catch { toast.error('Failed to save. Please try again.'); }
    finally { setSaving(false); }
  }

  return (
    <div className="nm-card" style={{ padding: 22 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="disp" style={{ fontSize: 16, fontWeight: 700, color: 'var(--nm-ink)', margin: 0 }}>Complete your profile</h3>
          <p style={{ fontSize: 12.5, color: 'var(--nm-muted)', margin: '3px 0 0' }}>{completedCount}/3 steps done — required to receive payouts</p>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {steps.map((s, i) => <div key={i} style={{ width: 28, height: 6, borderRadius: 999, background: s.done ? 'var(--nm-green)' : 'var(--nm-line)' }} />)}
        </div>
      </div>

      {/* Steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {steps.map((s, i) => (
          <div key={i} className="nm-card" style={{ padding: 0, overflow: 'hidden' }}>
            <button onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center gap-3"
              style={{ padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
              {s.done
                ? <CheckCircle size={20} style={{ color: 'var(--nm-green)', flexShrink: 0 }} />
                : <Circle size={20} style={{ color: 'var(--nm-line)', flexShrink: 0 }} />}
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--nm-ink)', margin: 0 }}>{s.label}</p>
                <p style={{ fontSize: 12, color: 'var(--nm-muted)', margin: 0 }}>{s.desc}</p>
              </div>
              <span className="nm-pill" style={{ background: s.done ? 'var(--nm-green-soft)' : 'var(--nm-gold-soft)', color: s.done ? 'var(--nm-green)' : 'var(--nm-gold-ink)', fontWeight: 700, fontSize: 11 }}>
                {s.done ? 'Done' : 'Pending'}
              </span>
              {!s.done && (open === i ? <ChevronUp size={16} style={{ color: 'var(--nm-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--nm-muted)' }} />)}
            </button>

            {/* Expandable form */}
            {open === i && !s.done && (
              <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--nm-line)' }}>
                {i === 0 && (<>
                  <div><label className="nm-label">Business name</label><input value={form.business_name} onChange={e => setForm(f => ({...f, business_name: e.target.value}))} className="nm-input" placeholder="Verité Distributors Pvt. Ltd." /></div>
                  <div><label className="nm-label">Business type</label>
                    <select value={form.business_type} onChange={e => setForm(f => ({...f, business_type: e.target.value}))} className="nm-select">
                      <option value="">Select type</option>
                      {['manufacturer','distributor','retailer','wholesaler'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="nm-label">State</label><input value={form.state} onChange={e => setForm(f => ({...f, state: e.target.value}))} className="nm-input" placeholder="Maharashtra" /></div>
                    <div><label className="nm-label">City</label><input value={form.city} onChange={e => setForm(f => ({...f, city: e.target.value}))} className="nm-input" placeholder="Mumbai" /></div>
                  </div>
                </>)}
                {i === 1 && (<>
                  <div><label className="nm-label">GSTIN</label><input value={form.gst_number} onChange={e => setForm(f => ({...f, gst_number: e.target.value.toUpperCase()}))} className="nm-input" placeholder="27AABCA1234A1Z5" maxLength={15} /></div>
                  <div><label className="nm-label">PAN</label><input value={form.pan_number} onChange={e => setForm(f => ({...f, pan_number: e.target.value.toUpperCase()}))} className="nm-input" placeholder="AABCA1234A" maxLength={10} /></div>
                  <p style={{ fontSize: 11.5, color: 'var(--nm-faint)' }}>🔒 Encrypted and used only for tax compliance</p>
                </>)}
                {i === 2 && (<>
                  <div><label className="nm-label">Account holder name</label><input value={form.account_holder} onChange={e => setForm(f => ({...f, account_holder: e.target.value}))} className="nm-input" /></div>
                  <div><label className="nm-label">Account number</label><input value={form.account_number} onChange={e => setForm(f => ({...f, account_number: e.target.value}))} className="nm-input" /></div>
                  <div><label className="nm-label">IFSC code</label><input value={form.ifsc} onChange={e => setForm(f => ({...f, ifsc: e.target.value.toUpperCase()}))} className="nm-input" placeholder="HDFC0001234" /></div>
                </>)}
                <button onClick={() => saveStep(i)} disabled={saving} className="nm-btn-primary" style={{ padding: '11px', fontSize: 13.5 }}>
                  {saving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : 'Save & continue'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <p style={{ fontSize: 12, color: 'var(--nm-faint)', textAlign: 'center', marginTop: 12 }}>
        You can use your dashboard while completing these steps
      </p>
    </div>
  );
}
