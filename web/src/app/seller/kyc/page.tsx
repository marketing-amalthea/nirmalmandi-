'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2, ShieldCheck, ShieldAlert, ShieldX, Shield, CheckCircle, Circle, ExternalLink, Mail } from 'lucide-react';
import api from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';
import { SellerAppShell, SectionCard } from '@/components/ui';

// ── Tier definitions ───────────────────────────────────────────
const TIERS = [
  {
    tier: 'basic',
    label: 'Basic',
    color: 'var(--nm-muted)',
    bg: 'var(--nm-panel)',
    unlocks: ['List up to 10 items', 'Receive orders', 'Access marketplace'],
  },
  {
    tier: 'verified',
    label: 'Verified',
    color: 'var(--nm-green)',
    bg: 'var(--nm-green-soft)',
    unlocks: ['Unlimited listings', 'Featured listing eligibility', 'GST invoice auto-generation', 'Buyer trust badge'],
  },
  {
    tier: 'premium',
    label: 'Premium',
    color: 'var(--nm-gold-ink)',
    bg: 'var(--nm-gold-soft)',
    unlocks: ['Homepage slot', 'Priority support', 'Analytics advanced mode', 'Bulk listing tools'],
  },
];

// ── Required documents list ────────────────────────────────────
const DOCUMENTS = [
  { key: 'gst', label: 'GST Certificate', desc: 'GSTIN registration certificate' },
  { key: 'pan', label: 'PAN Card', desc: 'Business or personal PAN' },
  { key: 'bank', label: 'Bank Account Proof', desc: 'Cancelled cheque or bank statement' },
  { key: 'address', label: 'Business Address Proof', desc: 'Utility bill or rent agreement' },
];

interface ProfileData {
  kyc_status: string;
  kyc_rejection_reason?: string;
  verification_tier?: string;
  business_name?: string;
  gst_number?: string;
  pan_number?: string;
  bank_account_last4?: string;
  address_line1?: string;
}

export default function SellerKycPage() {
  const router = useRouter();
  useEffect(() => { if (!isAuthenticated()) router.replace('/login'); }, [router]);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['kyc-profile'],
    queryFn: () => api.get('/profile/me'),
    select: (res) => {
      const d = (res.data as unknown as { data?: { profile?: ProfileData } })?.data;
      return d?.profile as ProfileData | undefined;
    },
    enabled: isAuthenticated(),
  });

  const status = profile?.kyc_status ?? 'pending';
  const tier = profile?.verification_tier ?? 'unverified';
  const currentTierIdx = TIERS.findIndex(t => t.tier === tier);

  // Determine which docs are "done" based on profile data
  const docStatus: Record<string, boolean> = {
    gst:     !!profile?.gst_number,
    pan:     !!profile?.pan_number,
    bank:    !!profile?.bank_account_last4,
    address: !!profile?.address_line1,
  };

  const StatusIcon = status === 'approved' ? ShieldCheck
    : status === 'rejected' ? ShieldX
    : status === 'in_review' ? ShieldAlert
    : Shield;

  const statusColor = status === 'approved' ? 'var(--nm-green)'
    : status === 'rejected' ? 'var(--nm-red)'
    : status === 'in_review' ? '#2563eb'
    : 'var(--nm-muted)';

  const statusBg = status === 'approved' ? 'var(--nm-green-soft)'
    : status === 'rejected' ? 'var(--nm-red-soft)'
    : status === 'in_review' ? 'rgba(37,99,235,.08)'
    : 'var(--nm-panel)';

  const statusLabel: Record<string, string> = {
    pending:   'Pending review',
    in_review: 'Under review',
    approved:  'KYC verified',
    rejected:  'KYC rejected',
  };

  return (
    <SellerAppShell
      title="KYC Verification"
      subtitle="Complete verification to unlock full platform access"
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={30} className="animate-spin" style={{ color: 'var(--nm-green)' }} />
        </div>
      ) : (
        <div className="flex flex-col gap-5" style={{ maxWidth: 860 }}>

          {/* Status banner */}
          <div className="nm-card flex items-center gap-5" style={{ padding: 24, background: statusBg, border: `1.5px solid ${statusColor}30` }}>
            <StatusIcon size={48} style={{ color: statusColor, flexShrink: 0 }} strokeWidth={1.5} />
            <div className="flex-1">
              <h2 className="disp" style={{ fontSize: 20, fontWeight: 800, color: statusColor, margin: 0 }}>
                {statusLabel[status] ?? 'Pending'}
              </h2>
              <p style={{ fontSize: 13.5, color: 'var(--nm-muted)', margin: '4px 0 0' }}>
                {status === 'approved' && 'Your KYC is verified. You have full access to the platform.'}
                {status === 'in_review' && 'Our team is reviewing your documents. This typically takes 1-2 business days.'}
                {status === 'pending' && 'Submit your documents below to start the verification process.'}
                {status === 'rejected' && (profile?.kyc_rejection_reason ?? 'Your KYC was rejected. Please contact support.')}
              </p>
              {status === 'rejected' && (
                <a href="mailto:support@nirmalmandi.com?subject=KYC Resubmission"
                  className="inline-flex items-center gap-1.5"
                  style={{ marginTop: 10, fontSize: 13, color: 'var(--nm-red)', fontWeight: 600, textDecoration: 'none' }}>
                  <Mail size={14} /> Contact support to resubmit
                </a>
              )}
            </div>
            {status === 'approved' && (
              <span className="nm-pill" style={{ background: 'var(--nm-green)', color: '#fff', fontWeight: 700, fontSize: 12, padding: '6px 14px' }}>
                ✓ Verified
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Documents checklist */}
            <SectionCard title="Required documents">
              <div className="flex flex-col gap-2">
                {DOCUMENTS.map(doc => {
                  const done = docStatus[doc.key];
                  return (
                    <div key={doc.key} className="flex items-center gap-3" style={{
                      padding: '12px 14px', borderRadius: 12,
                      background: done ? 'var(--nm-green-soft)' : 'var(--nm-panel)',
                      border: `1px solid ${done ? 'rgba(31,107,58,.2)' : 'var(--nm-line)'}`,
                    }}>
                      {done
                        ? <CheckCircle size={18} style={{ color: 'var(--nm-green)', flexShrink: 0 }} />
                        : <Circle size={18} style={{ color: 'var(--nm-faint)', flexShrink: 0 }} />}
                      <div className="flex-1">
                        <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--nm-ink)', margin: 0 }}>{doc.label}</p>
                        <p style={{ fontSize: 12, color: 'var(--nm-muted)', margin: 0 }}>{doc.desc}</p>
                      </div>
                      <span className="nm-pill" style={{
                        background: done ? 'var(--nm-green-soft)' : 'var(--nm-gold-soft)',
                        color: done ? 'var(--nm-green)' : 'var(--nm-gold-ink)',
                        fontWeight: 700, fontSize: 11,
                      }}>
                        {done ? 'On file' : 'Needed'}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 14, padding: 14, borderRadius: 12, background: 'var(--nm-panel)', border: '1px solid var(--nm-line)' }}>
                <p style={{ fontSize: 12.5, color: 'var(--nm-muted)', margin: 0 }}>
                  Documents are submitted through your <strong>Profile</strong> page. Once submitted, our team reviews them within 1-2 business days.
                </p>
                <a href="/seller/profile" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8, fontSize: 13, color: 'var(--nm-green)', fontWeight: 600, textDecoration: 'none' }}>
                  <ExternalLink size={13} /> Go to Profile to add documents
                </a>
              </div>
            </SectionCard>

            {/* Tier progression */}
            <SectionCard title="Verification tiers">
              <div className="flex flex-col gap-3">
                {TIERS.map((t, i) => {
                  const isCurrent = t.tier === tier;
                  const isUnlocked = currentTierIdx >= i;
                  return (
                    <div key={t.tier} style={{
                      padding: '14px 16px', borderRadius: 14,
                      border: `1.5px solid ${isCurrent ? t.color : 'var(--nm-line)'}`,
                      background: isCurrent ? t.bg : 'var(--nm-panel)',
                      opacity: isUnlocked ? 1 : 0.6,
                    }}>
                      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                        <span className="disp" style={{ fontSize: 14, fontWeight: 700, color: isCurrent ? t.color : 'var(--nm-ink)' }}>
                          {t.label}
                        </span>
                        {isCurrent && (
                          <span className="nm-pill" style={{ background: t.color, color: '#fff', fontSize: 10, fontWeight: 700 }}>
                            Current
                          </span>
                        )}
                        {isUnlocked && !isCurrent && (
                          <CheckCircle size={16} style={{ color: 'var(--nm-green)' }} />
                        )}
                      </div>
                      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {t.unlocks.map(u => (
                          <li key={u} className="flex items-center gap-2" style={{ fontSize: 12.5, color: 'var(--nm-muted)' }}>
                            <span style={{ color: isUnlocked ? t.color : 'var(--nm-faint)' }}>✓</span> {u}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          </div>

          {/* Help */}
          <div style={{ padding: '16px 20px', borderRadius: 14, background: 'var(--nm-panel)', border: '1px solid var(--nm-line)' }}>
            <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--nm-ink)', margin: '0 0 4px' }}>Need help with KYC?</p>
            <p style={{ fontSize: 13, color: 'var(--nm-muted)', margin: '0 0 10px' }}>
              Our team is available Monday–Saturday, 10 AM – 6 PM IST.
            </p>
            <a href="mailto:support@nirmalmandi.com" className="nm-btn-secondary"
              style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
              <Mail size={14} /> Email support@nirmalmandi.com
            </a>
          </div>
        </div>
      )}
    </SellerAppShell>
  );
}
