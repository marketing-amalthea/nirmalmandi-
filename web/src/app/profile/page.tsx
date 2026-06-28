'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Pencil, Save, X, MapPin, Mail, Phone } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getUser, isAuthenticated } from '@/lib/auth';
import { AppShell, Avatar } from '@/components/ui';
import { useBuyerNav, BUYER_SIDEBAR_FOOTER } from '@/lib/buyerNav';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu & Kashmir', 'Ladakh',
];

interface BuyerProfile {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  language_preference?: string;
  profile?: {
    business_name?: string;
    gst_number?: string;
    verification_tier?: string;
    total_purchases?: number;
    ai_credits_balance?: number;
    city?: string;
    state?: string;
  };
}

function fmtDate(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--nm-line-soft)' }}>
      <span style={{ fontSize: 13, color: 'var(--nm-muted)' }}>{label}</span>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: value ? 'var(--nm-ink)' : 'var(--nm-faint)' }}>{value || '—'}</span>
    </div>
  );
}

export default function BuyerProfilePage() {
  const router = useRouter();
  const qc = useQueryClient();
  const localUser = getUser();
  const buyerNav = useBuyerNav();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', city: '', state: '', language_preference: 'en' });

  useEffect(() => { if (!isAuthenticated()) router.replace('/login'); }, [router]);

  const { data, isLoading } = useQuery({
    queryKey: ['buyer-profile'],
    queryFn: () => api.get('/profile/me'),
    select: (res) => {
      const d = (res.data as unknown as { data?: BuyerProfile })?.data;
      return d as BuyerProfile | undefined;
    },
    enabled: isAuthenticated(),
  });

  function startEdit() {
    if (!data) return;
    setForm({
      name: data.name ?? '',
      city: data.profile?.city ?? '',
      state: data.profile?.state ?? '',
      language_preference: data.language_preference ?? 'en',
    });
    setEditing(true);
  }

  const mutation = useMutation({
    mutationFn: (payload: typeof form) => api.patch('/profile/me', payload),
    onSuccess: () => {
      toast.success('Profile updated');
      qc.invalidateQueries({ queryKey: ['buyer-profile'] });
      setEditing(false);
    },
    onError: () => toast.error('Failed to update profile'),
  });

  const name = data?.name ?? localUser?.name ?? '—';
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w: string) => w[0]).join('').toUpperCase() || 'B';
  const tier = data?.profile?.verification_tier ?? 'tier1';

  return (
    <AppShell
      navItems={buyerNav}
      brandSub="Buyer Portal"
      sidebarFooter={BUYER_SIDEBAR_FOOTER}
      title="My Profile"
      subtitle="Account and business details"
      actions={
        <div className="flex items-center gap-3">
          {editing ? (
            <>
              <button onClick={() => setEditing(false)} className="nm-btn-secondary" style={{ fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <X size={14} /> Cancel
              </button>
              <button onClick={() => mutation.mutate(form)} disabled={mutation.isPending} className="nm-btn-primary"
                style={{ fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                {mutation.isPending ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Save size={14} /> Save</>}
              </button>
            </>
          ) : (
            <button onClick={startEdit} className="nm-btn-secondary" style={{ fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Pencil size={14} /> Edit profile
            </button>
          )}
        </div>
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={30} className="animate-spin" style={{ color: 'var(--nm-green)' }} />
        </div>
      ) : (
        <div className="flex flex-col gap-5" style={{ maxWidth: 760 }}>
          {/* Header */}
          <div className="nm-card flex flex-wrap items-center gap-5" style={{ padding: 24 }}>
            <Avatar initials={initials} size={68} />
            <div className="flex-1">
              {editing ? (
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="nm-input disp" style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }} />
              ) : (
                <h2 className="disp" style={{ fontSize: 22, fontWeight: 800, color: 'var(--nm-ink)', margin: 0 }}>{name}</h2>
              )}
              <div className="flex items-center gap-3 flex-wrap" style={{ marginTop: 6 }}>
                {data?.email && <span style={{ fontSize: 13, color: 'var(--nm-muted)', display: 'flex', alignItems: 'center', gap: 4 }}><Mail size={13} />{data.email}</span>}
                {data?.phone && !data.phone.startsWith('em_') && <span style={{ fontSize: 13, color: 'var(--nm-muted)', display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={13} />{data.phone}</span>}
                {(data?.profile?.city || data?.profile?.state) && (
                  <span style={{ fontSize: 13, color: 'var(--nm-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <MapPin size={13} />{[data.profile?.city, data.profile?.state].filter(Boolean).join(', ')}
                  </span>
                )}
                <span className="nm-pill" style={{ background: 'var(--nm-green-soft)', color: 'var(--nm-green)', fontWeight: 700, fontSize: 11, textTransform: 'capitalize' }}>
                  {tier.replace('tier', 'Tier ')} buyer
                </span>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="num disp" style={{ fontSize: 20, fontWeight: 800, color: 'var(--nm-ink)', margin: 0 }}>
                  {Number(data?.profile?.total_purchases ?? 0).toLocaleString('en-IN')}
                </p>
                <p style={{ fontSize: 11.5, color: 'var(--nm-muted)', margin: '2px 0 0' }}>Total spent (₹)</p>
              </div>
              <div className="text-center">
                <p className="num disp" style={{ fontSize: 20, fontWeight: 800, color: 'var(--nm-green)', margin: 0 }}>
                  {data?.profile?.ai_credits_balance ?? 0}
                </p>
                <p style={{ fontSize: 11.5, color: 'var(--nm-muted)', margin: '2px 0 0' }}>AI credits</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Account details */}
            <div className="nm-card" style={{ padding: 22 }}>
              <h3 className="disp" style={{ fontSize: 15, fontWeight: 700, color: 'var(--nm-ink)', margin: '0 0 4px' }}>Account</h3>
              <Row label="Email" value={data?.email ?? '—'} />
              <Row label="Phone" value={data?.phone && !data.phone.startsWith('em_') ? data.phone : '—'} />
              {editing ? (
                <>
                  <div style={{ padding: '10px 0', borderBottom: '1px solid var(--nm-line-soft)' }}>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--nm-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>City</label>
                    <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} className="nm-input" placeholder="Mumbai" />
                  </div>
                  <div style={{ padding: '10px 0' }}>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--nm-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>State</label>
                    <select value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} className="nm-select" style={{ width: '100%' }}>
                      <option value="">Select state…</option>
                      {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <Row label="City" value={data?.profile?.city ?? ''} />
                  <Row label="State" value={data?.profile?.state ?? ''} />
                </>
              )}
            </div>

            {/* Business */}
            <div className="nm-card" style={{ padding: 22 }}>
              <h3 className="disp" style={{ fontSize: 15, fontWeight: 700, color: 'var(--nm-ink)', margin: '0 0 4px' }}>Business</h3>
              <Row label="Business name" value={data?.profile?.business_name ?? ''} />
              <Row label="GSTIN" value={data?.profile?.gst_number ?? ''} />
              <Row label="Buyer tier" value={tier.replace('tier', 'Tier ')} />
              <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: 'var(--nm-panel)', border: '1px solid var(--nm-line)' }}>
                <p style={{ fontSize: 12, color: 'var(--nm-muted)', margin: 0 }}>
                  Contact support to update business name or GSTIN.
                </p>
              </div>
            </div>
          </div>

          {/* Security */}
          <div className="nm-card" style={{ padding: 22 }}>
            <h3 className="disp" style={{ fontSize: 15, fontWeight: 700, color: 'var(--nm-ink)', margin: '0 0 12px' }}>Security</h3>
            <div className="flex items-center justify-between">
              <div>
                <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--nm-ink)', margin: 0 }}>Password</p>
                <p style={{ fontSize: 12.5, color: 'var(--nm-muted)', margin: '2px 0 0' }}>Change your account password</p>
              </div>
              <button onClick={() => router.push('/change-password')} className="nm-btn-secondary" style={{ fontSize: 13 }}>
                Change password
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
