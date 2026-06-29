'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Lock, AlertTriangle, X } from 'lucide-react';
import { toast } from 'sonner';
import { SellerAppShell, SectionCard, Toggle } from '@/components/ui';
import api from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';

// ── Types ──────────────────────────────────────────────────────────────────────
interface SellerProfile {
  business_name?: string;
  gst_number?: string;
  bank_account_last4?: string;
  ifsc?: string;
  notification_prefs?: NotifPrefs;
}

interface NotifPrefs {
  order_updates_email: boolean;
  payment_notifications_email: boolean;
  dispute_alerts_email: boolean;
}

const DEFAULT_PREFS: NotifPrefs = {
  order_updates_email: true,
  payment_notifications_email: true,
  dispute_alerts_email: true,
};

// ── Notification preference row ──────────────────────────────────────────────────
function PrefRow({
  label, desc, on, onToggle,
}: { label: string; desc: string; on: boolean; onToggle: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between" style={{ padding: '14px 0', borderBottom: '1px solid var(--nm-line)' }}>
      <div style={{ maxWidth: 420 }}>
        <p className="disp" style={{ fontSize: 14, fontWeight: 600, color: 'var(--nm-ink)', margin: 0 }}>{label}</p>
        <p style={{ fontSize: 12.5, color: 'var(--nm-muted)', margin: '2px 0 0' }}>{desc}</p>
      </div>
      <Toggle on={on} onChange={onToggle} />
    </div>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between" style={{ padding: '12px 0', borderBottom: '1px solid var(--nm-line)' }}>
      <span style={{ fontSize: 13, color: 'var(--nm-muted)' }}>{label}</span>
      <span className="num" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--nm-ink)' }}>{value}</span>
    </div>
  );
}

export default function SellerSettingsPage() {
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['seller-settings-profile'],
    queryFn: () => api.get<{ data: SellerProfile }>('/profile/me'),
    select: (res) => (res.data as unknown as { data: SellerProfile })?.data ?? (res.data as SellerProfile),
    enabled: ready && isAuthenticated(),
  });
  const profile: SellerProfile = data ?? {};

  // ── Notification preferences ───────────────────────────────────────────────
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => {
    if (profile.notification_prefs) {
      setPrefs({ ...DEFAULT_PREFS, ...profile.notification_prefs });
    }
  }, [profile.notification_prefs]);

  async function updatePref(key: keyof NotifPrefs, value: boolean) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    setSavingPrefs(true);
    try {
      await api.patch('/profile/me', { notification_prefs: next });
      toast.success('Preferences saved');
    } catch {
      setPrefs(prefs); // revert
      toast.error('Failed to save preferences');
    } finally {
      setSavingPrefs(false);
    }
  }

  // ── Change password ────────────────────────────────────────────────────────
  const [pwOpen, setPwOpen] = useState(false);
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);

  async function changePassword() {
    if (pwForm.new_password.length < 8) { toast.error('New password must be at least 8 characters'); return; }
    if (pwForm.new_password !== pwForm.confirm) { toast.error('Passwords do not match'); return; }
    setPwSaving(true);
    try {
      await api.patch('/profile/password', {
        current_password: pwForm.current_password,
        new_password: pwForm.new_password,
      });
      toast.success('Password changed');
      setPwOpen(false);
      setPwForm({ current_password: '', new_password: '', confirm: '' });
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err?.response?.data?.error ?? 'Failed to change password');
    } finally {
      setPwSaving(false);
    }
  }

  // ── Danger zone: pause all listings ────────────────────────────────────────
  const [pauseOpen, setPauseOpen] = useState(false);
  const [pausing, setPausing] = useState(false);

  async function pauseAll() {
    setPausing(true);
    try {
      const res = await api.patch<{ data?: { paused?: number } }>('/seller/listings/bulk-pause');
      const count = (res.data as unknown as { data?: { paused?: number } })?.data?.paused;
      toast.success(typeof count === 'number' ? `Paused ${count} listing${count === 1 ? '' : 's'}` : 'All listings paused');
      setPauseOpen(false);
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { error?: string } } };
      toast.error(err?.response?.data?.error ?? 'Failed to pause listings. Please try again or contact support.');
    } finally {
      setPausing(false);
    }
  }

  const maskedAccount = profile.bank_account_last4 ? `••••  ••••  ${profile.bank_account_last4}` : '—';

  return (
    <SellerAppShell
      title="Settings"
      subtitle="Manage notifications, account & business details"
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin" style={{ color: 'var(--nm-green)' }} />
        </div>
      ) : (
        <div className="flex flex-col gap-5" style={{ maxWidth: 680 }}>
          {/* Notification preferences */}
          <SectionCard title="Notification preferences">
            <p style={{ fontSize: 12.5, color: 'var(--nm-muted)', margin: '0 0 6px' }}>
              Choose which emails you want to receive. {savingPrefs && 'Saving…'}
            </p>
            <PrefRow
              label="Order updates"
              desc="New orders, cancellations and shipping reminders by email."
              on={prefs.order_updates_email}
              onToggle={(v) => updatePref('order_updates_email', v)}
            />
            <PrefRow
              label="Payment notifications"
              desc="Payout confirmations and escrow release alerts by email."
              on={prefs.payment_notifications_email}
              onToggle={(v) => updatePref('payment_notifications_email', v)}
            />
            <div style={{ borderBottom: 'none' }}>
              <PrefRow
                label="Dispute alerts"
                desc="Get notified by email when a buyer raises a dispute."
                on={prefs.dispute_alerts_email}
                onToggle={(v) => updatePref('dispute_alerts_email', v)}
              />
            </div>
          </SectionCard>

          {/* Business settings (read-only) */}
          <SectionCard title="Business settings">
            <ReadOnlyRow label="Business name" value={profile.business_name ?? '—'} />
            <ReadOnlyRow label="GST number" value={profile.gst_number ?? '—'} />
            <ReadOnlyRow label="Bank account" value={maskedAccount} />
            <div style={{ borderBottom: 'none' }}>
              <ReadOnlyRow label="IFSC" value={profile.ifsc ?? '—'} />
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--nm-muted)', margin: '14px 0 0' }}>
              Contact support to update these details.
            </p>
          </SectionCard>

          {/* Account */}
          <SectionCard title="Account">
            {!pwOpen ? (
              <button onClick={() => setPwOpen(true)} className="nm-btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13.5 }}>
                <Lock size={15} /> Change password
              </button>
            ) : (
              <div className="flex flex-col gap-3" style={{ maxWidth: 360 }}>
                <div>
                  <label className="nm-label">Current password</label>
                  <input type="password" autoComplete="current-password" className="nm-input"
                    value={pwForm.current_password}
                    onChange={(e) => setPwForm((f) => ({ ...f, current_password: e.target.value }))} />
                </div>
                <div>
                  <label className="nm-label">New password</label>
                  <input type="password" autoComplete="new-password" className="nm-input"
                    value={pwForm.new_password}
                    onChange={(e) => setPwForm((f) => ({ ...f, new_password: e.target.value }))} />
                </div>
                <div>
                  <label className="nm-label">Confirm new password</label>
                  <input type="password" autoComplete="new-password" className="nm-input"
                    value={pwForm.confirm}
                    onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))} />
                </div>
                <div className="flex items-center gap-2.5" style={{ marginTop: 4 }}>
                  <button onClick={changePassword} disabled={pwSaving} className="nm-btn-primary" style={{ fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {pwSaving && <Loader2 size={14} className="animate-spin" />} Update password
                  </button>
                  <button onClick={() => { setPwOpen(false); setPwForm({ current_password: '', new_password: '', confirm: '' }); }} className="nm-btn-secondary" style={{ fontSize: 13.5 }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </SectionCard>

          {/* Danger zone */}
          <SectionCard title="Danger zone" style={{ borderColor: 'var(--nm-line)' }}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div style={{ maxWidth: 420 }}>
                <p className="disp" style={{ fontSize: 14, fontWeight: 600, color: 'var(--nm-ink)', margin: 0 }}>Pause all listings</p>
                <p style={{ fontSize: 12.5, color: 'var(--nm-muted)', margin: '3px 0 0' }}>
                  Temporarily hides every live listing from buyers. You can re-list them individually at any time.
                </p>
              </div>
              <button
                onClick={() => setPauseOpen(true)}
                className="nm-btn-secondary"
                style={{ fontSize: 13.5, color: 'var(--nm-red, #b91c1c)', borderColor: 'var(--nm-red, #b91c1c)', display: 'inline-flex', alignItems: 'center', gap: 7 }}
              >
                <AlertTriangle size={15} /> Pause all
              </button>
            </div>
          </SectionCard>
        </div>
      )}

      {/* Pause-all confirmation dialog */}
      {pauseOpen && (
        <div
          onClick={() => !pausing && setPauseOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(20,28,18,.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div onClick={(e) => e.stopPropagation()} className="nm-card" style={{ width: '100%', maxWidth: 420, padding: 24 }}>
            <div className="flex items-start justify-between" style={{ marginBottom: 12 }}>
              <h3 className="disp" style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--nm-ink)' }}>Pause all listings?</h3>
              <button onClick={() => !pausing && setPauseOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--nm-muted)' }}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: 13.5, color: 'var(--nm-muted)', lineHeight: 1.5, margin: '0 0 20px' }}>
              This will pause every live listing in your catalogue. Buyers will no longer be able to find or order them until you re-list.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button onClick={() => setPauseOpen(false)} disabled={pausing} className="nm-btn-secondary" style={{ fontSize: 13.5 }}>Cancel</button>
              <button onClick={pauseAll} disabled={pausing} className="nm-btn-primary" style={{ fontSize: 13.5, background: 'var(--nm-red, #b91c1c)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {pausing && <Loader2 size={14} className="animate-spin" />} Yes, pause all
              </button>
            </div>
          </div>
        </div>
      )}
    </SellerAppShell>
  );
}
