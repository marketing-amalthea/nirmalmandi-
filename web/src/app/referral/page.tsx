'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Copy, CheckCircle, Gift } from 'lucide-react';
import { toast } from 'sonner';
import { AppShell, inr } from '@/components/ui';
import { referralApi, type ReferralEntry, type ReferralPayout, type ReferralStats } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';
import { useBuyerNav, BUYER_SIDEBAR_FOOTER } from '@/lib/buyerNav';

const HOW_IT_WORKS = [
  { title: 'Share your code', body: 'Send your referral link or code to other businesses.' },
  { title: 'They make a purchase', body: 'Your referral signs up and completes their first order.' },
  { title: 'You earn', body: 'Get 2% commission credited to your wallet — paid out monthly.' },
];

export default function ReferralPage() {
  const router = useRouter();
  const buyerNav = useBuyerNav();
  const [copied, setCopied] = useState(false);

  useEffect(() => { if (!isAuthenticated()) router.replace('/login'); }, [router]);

  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ['referral-stats'],
    queryFn: () => referralApi.getStats(),
    select: (res): ReferralStats => {
      const raw = res.data as unknown;
      const wrapped = raw as { data?: ReferralStats };
      return wrapped.data ?? (raw as ReferralStats);
    },
    enabled: isAuthenticated(),
  });

  async function handleCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  }

  if (isLoading) {
    return (
      <AppShell navItems={buyerNav} brandSub="Buyer Portal" sidebarFooter={BUYER_SIDEBAR_FOOTER} title="Referral">
        <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin" style={{ color: 'var(--nm-green)' }} /></div>
      </AppShell>
    );
  }

  if (isError || !stats) {
    return (
      <AppShell navItems={buyerNav} brandSub="Buyer Portal" sidebarFooter={BUYER_SIDEBAR_FOOTER} title="Referral">
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <Gift size={48} style={{ color: 'var(--nm-faint)' }} />
          <h2 className="disp" style={{ fontSize: 18, fontWeight: 700, color: 'var(--nm-ink)' }}>Referral data unavailable</h2>
          <p style={{ fontSize: 13.5, color: 'var(--nm-muted)' }}>Please try again later</p>
        </div>
      </AppShell>
    );
  }

  const whatsappText = encodeURIComponent(`Join NirmalMandi — India's B2B Dead Inventory Marketplace. Buy surplus stock at unbeatable prices! Use my link: ${stats.link}`);
  const whatsappUrl = `https://wa.me/?text=${whatsappText}`;

  const referrals: ReferralEntry[] = Array.isArray(stats.referrals) ? stats.referrals : [];
  const payouts: ReferralPayout[] = Array.isArray(stats.payouts) ? stats.payouts : [];
  const totalInvites = stats.total_shares ?? referrals.length;
  const successful = stats.conversions ?? referrals.filter((r) => r.status === 'paid').length;
  const totalEarned = stats.total_earned ?? 0;
  const pending = payouts.filter((p) => p.status !== 'paid').reduce((s, p) => s + (p.amount ?? 0), 0);

  const STATS = [
    { label: 'Total invites', value: totalInvites.toLocaleString('en-IN') },
    { label: 'Successful', value: successful.toLocaleString('en-IN') },
    { label: 'Total earned', value: inr(totalEarned) },
    { label: 'Pending', value: inr(pending) },
  ];

  return (
    <AppShell navItems={buyerNav} brandSub="Buyer Portal" sidebarFooter={BUYER_SIDEBAR_FOOTER} title="Referral">
      <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 24, maxWidth: 1000 }}>
        {/* ── Code card ── */}
        <div className="gradient-hero" style={{ borderRadius: 20, padding: 32, color: '#fff' }}>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your referral code</p>
          <p className="disp" style={{ fontSize: 36, fontWeight: 800, color: '#f4a82a', margin: '6px 0 20px', letterSpacing: '0.04em' }}>{stats.code}</p>

          <div className="flex items-center justify-center" style={{ width: 120, height: 120, background: '#fff', borderRadius: 12, padding: 8, marginBottom: 22 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(stats.link)}&bgcolor=ffffff&color=14492a`}
              alt="Referral QR code" width={104} height={104} style={{ borderRadius: 6 }}
            />
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button onClick={() => handleCopy(stats.link)} className="nm-btn-gold">
              {copied ? <CheckCircle size={15} /> : <Copy size={15} />} {copied ? 'Copied!' : 'Copy link'}
            </button>
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="nm-btn-secondary no-underline" style={{ color: '#fff', borderColor: 'rgba(255,255,255,.3)' }}>
              Share on WhatsApp
            </a>
          </div>
        </div>

        {/* ── Right column ── */}
        <div className="flex flex-col" style={{ gap: 20 }}>
          <div className="grid grid-cols-2" style={{ gap: 16 }}>
            {STATS.map((s) => (
              <div key={s.label} className="nm-card" style={{ padding: 18 }}>
                <p style={{ fontSize: 11.5, color: 'var(--nm-muted)', margin: 0, fontWeight: 600 }}>{s.label}</p>
                <p className="num" style={{ fontSize: 24, fontWeight: 800, color: 'var(--nm-ink)', margin: '6px 0 0' }}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="nm-card" style={{ padding: 22 }}>
            <h3 className="disp" style={{ fontSize: 15, fontWeight: 700, color: 'var(--nm-ink)', margin: '0 0 18px' }}>How it works</h3>
            <div className="flex flex-col" style={{ gap: 16 }}>
              {HOW_IT_WORKS.map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="disp flex items-center justify-center flex-shrink-0" style={{ width: 28, height: 28, borderRadius: 999, background: 'var(--nm-deep)', color: '#fff', fontSize: 13, fontWeight: 800 }}>{i + 1}</div>
                  <div>
                    <p className="disp" style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--nm-ink)', margin: 0 }}>{step.title}</p>
                    <p style={{ fontSize: 12.5, color: 'var(--nm-muted)', margin: '2px 0 0', lineHeight: 1.45 }}>{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
