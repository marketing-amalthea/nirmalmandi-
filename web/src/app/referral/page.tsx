'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Loader2, Copy, CheckCircle, Share2, Gift, TrendingUp,
  Users, MousePointer, IndianRupee, Award
} from 'lucide-react';
import { toast } from 'sonner';
import Header from '@/components/Header';
import { referralApi, type ReferralEntry, type ReferralPayout, type ReferralStats } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';

type Tier = 'silver' | 'gold' | 'platinum';

const TIERS: Record<Tier, {
  label: string;
  range: string;
  min: number;
  max: number | null;
  color: string;
  bg: string;
  border: string;
  benefits: string;
}> = {
  silver: {
    label: 'Silver',
    range: '0–10 referrals',
    min: 0,
    max: 10,
    color: 'text-gray-600',
    bg: 'bg-gray-100',
    border: 'border-gray-300',
    benefits: '2% commission on referred buyers\' first purchase',
  },
  gold: {
    label: 'Gold',
    range: '11–50 referrals',
    min: 11,
    max: 50,
    color: 'text-yellow-700',
    bg: 'bg-yellow-50',
    border: 'border-yellow-400',
    benefits: '2.5% commission + ₹500 monthly bonus at 25+ referrals',
  },
  platinum: {
    label: 'Platinum',
    range: '51+ referrals',
    min: 51,
    max: null,
    color: 'text-purple-700',
    bg: 'bg-purple-50',
    border: 'border-purple-400',
    benefits: '3% commission + priority support + ₹2,000 monthly bonus',
  },
};

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-green-100 text-green-700',
  processing: 'bg-blue-100 text-blue-700',
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  }
  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors ${
        copied
          ? 'bg-green-100 text-green-700'
          : 'bg-white/20 hover:bg-white/30 text-white'
      }`}
    >
      {copied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

export default function ReferralPage() {
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) router.replace('/login');
  }, [router]);

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

  const referralCount = stats?.referral_count ?? stats?.conversions ?? 0;
  const currentTier: Tier = stats?.tier ?? (
    referralCount >= 51 ? 'platinum' : referralCount >= 11 ? 'gold' : 'silver'
  );
  const nextTier: Tier | null = currentTier === 'silver' ? 'gold' : currentTier === 'gold' ? 'platinum' : null;
  const tierInfo = TIERS[currentTier];
  const nextTierInfo = nextTier ? TIERS[nextTier] : null;

  // Progress within tier
  let tierProgress = 0;
  if (currentTier === 'silver') {
    tierProgress = (referralCount / 10) * 100;
  } else if (currentTier === 'gold') {
    tierProgress = ((referralCount - 11) / (50 - 11)) * 100;
  } else {
    tierProgress = 100;
  }
  tierProgress = Math.min(100, Math.max(0, tierProgress));

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
          <Gift className="w-12 h-12 text-gray-300" />
          <h2 className="text-xl font-semibold text-gray-700">Referral data unavailable</h2>
          <p className="text-sm text-gray-500">Please try again later</p>
        </div>
      </div>
    );
  }

  const whatsappText = encodeURIComponent(
    `Join NirmalMandi — India's B2B Dead Inventory Marketplace. Buy surplus stock at unbeatable prices! Use my link: ${stats.link}`
  );
  const whatsappUrl = `https://wa.me/?text=${whatsappText}`;

  const referrals: ReferralEntry[] = Array.isArray(stats.referrals) ? stats.referrals : [];
  const payouts: ReferralPayout[] = Array.isArray(stats.payouts) ? stats.payouts : [];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Referral Program</h1>

        {/* Hero box */}
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl p-6 sm:p-8 text-white mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Gift className="w-5 h-5 text-indigo-200" />
            <p className="text-indigo-200 text-sm font-medium">Earn 2% of every first purchase by buyers you refer</p>
          </div>

          <div className="mb-5">
            <p className="text-indigo-200 text-xs uppercase tracking-wider mb-1">Your Referral Code</p>
            <div className="flex items-center gap-3">
              <span className="font-mono text-3xl font-bold tracking-widest">{stats.code}</span>
              <CopyButton text={stats.code} />
            </div>
          </div>

          <div>
            <p className="text-indigo-200 text-xs uppercase tracking-wider mb-1">Referral Link</p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm bg-white/10 rounded-lg px-3 py-1.5 truncate max-w-xs text-indigo-100">
                {stats.link}
              </span>
              <CopyButton text={stats.link} />
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs font-medium bg-green-500 hover:bg-green-600 text-white px-2.5 py-1.5 rounded-lg transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" />
                WhatsApp
              </a>
            </div>
          </div>

          {/* QR Code */}
          <div className="mt-4 flex items-center gap-4">
            <div className="bg-white rounded-xl p-2 flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(stats.link)}&bgcolor=ffffff&color=1e1b4b`}
                alt="Referral QR Code"
                width={100}
                height={100}
                className="rounded-lg"
              />
            </div>
            <div>
              <p className="text-white font-semibold text-sm mb-1">Scan to share</p>
              <p className="text-indigo-200 text-xs leading-relaxed">
                Show this QR at trade fairs, expos,<br />or WhatsApp it to buyers directly.
              </p>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            {
              label: 'Total Shares',
              value: (stats.total_shares ?? 0).toLocaleString('en-IN'),
              icon: Share2,
              color: 'text-indigo-600 bg-indigo-50',
            },
            {
              label: 'Link Clicks',
              value: (stats.clicks ?? 0).toLocaleString('en-IN'),
              icon: MousePointer,
              color: 'text-blue-600 bg-blue-50',
            },
            {
              label: 'Conversions',
              value: (stats.conversions ?? 0).toLocaleString('en-IN'),
              icon: Users,
              color: 'text-green-600 bg-green-50',
            },
            {
              label: 'Total Earned',
              value: `₹${(stats.total_earned ?? 0).toLocaleString('en-IN')}`,
              icon: IndianRupee,
              color: 'text-accent-600 bg-accent-50',
            },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="card p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
            </div>
          ))}
        </div>

        {/* Tier progress */}
        <div className="card p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-5 flex items-center gap-2">
            <Award className="w-4 h-4 text-primary-600" />
            Your Referral Tier
          </h2>

          {/* Tier path */}
          <div className="relative flex items-center justify-between mb-6">
            {(['silver', 'gold', 'platinum'] as Tier[]).map((tier, idx) => {
              const t = TIERS[tier];
              const isActive = tier === currentTier;
              const isPast = idx < (['silver', 'gold', 'platinum'] as Tier[]).indexOf(currentTier);
              return (
                <div key={tier} className="flex items-center flex-1">
                  <div className="flex flex-col items-center z-10">
                    <div
                      className={`w-12 h-12 rounded-full border-2 flex items-center justify-center font-bold text-sm transition-all ${
                        isActive
                          ? `${t.bg} ${t.border} ${t.color} ring-4 ring-offset-2 ring-${tier === 'silver' ? 'gray' : tier === 'gold' ? 'yellow' : 'purple'}-200`
                          : isPast
                            ? `bg-primary-600 border-primary-600 text-white`
                            : `bg-gray-100 border-gray-200 text-gray-400`
                      }`}
                    >
                      {isPast ? <CheckCircle className="w-5 h-5" /> : t.label[0]}
                    </div>
                    <p className={`text-xs font-semibold mt-1.5 ${isActive ? t.color : isPast ? 'text-primary-600' : 'text-gray-400'}`}>
                      {t.label}
                    </p>
                    <p className="text-[10px] text-gray-400">{t.range}</p>
                  </div>
                  {idx < 2 && (
                    <div className={`flex-1 h-1 mx-2 rounded-full ${isPast || isActive ? 'bg-primary-600' : 'bg-gray-200'}`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Progress bar to next tier */}
          {nextTierInfo && (
            <div className="mb-4">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>{referralCount} referrals</span>
                <span>{nextTierInfo.min} needed for {nextTierInfo.label}</span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                  style={{ width: `${tierProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Current tier benefits */}
          <div className={`rounded-xl p-4 border ${tierInfo.border} ${tierInfo.bg}`}>
            <p className={`text-sm font-semibold ${tierInfo.color} mb-1 flex items-center gap-1.5`}>
              <TrendingUp className="w-4 h-4" />
              {tierInfo.label} Tier Benefits
            </p>
            <p className={`text-sm ${tierInfo.color} opacity-80`}>{tierInfo.benefits}</p>
          </div>
        </div>

        {/* Referral history */}
        <div className="card overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Referral History</h2>
            <span className="badge bg-gray-100 text-gray-600">{referrals.length} total</span>
          </div>
          {referrals.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No referrals yet. Share your link to get started!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                    <th className="text-left px-6 py-3 font-medium">Referred Buyer</th>
                    <th className="text-left px-6 py-3 font-medium">Date</th>
                    <th className="text-right px-6 py-3 font-medium">Their Purchase</th>
                    <th className="text-right px-6 py-3 font-medium">Your Commission</th>
                    <th className="text-left px-6 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {referrals.map((r) => {
                    const nameParts = (r.buyer_name ?? '').split(' ');
                    const displayName = nameParts.length > 1
                      ? `${nameParts[0]} ${nameParts[nameParts.length - 1][0]}.`
                      : nameParts[0] ?? '—';
                    return (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-gray-800">{displayName}</td>
                        <td className="px-6 py-4 text-gray-500">{formatDate(r.date)}</td>
                        <td className="px-6 py-4 text-right text-gray-800">
                          ₹{(r.purchase_amount ?? 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-green-700">
                          ₹{(r.commission ?? 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`badge ${STATUS_BADGE[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Payout history */}
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Payout History</h2>
            <span className="badge bg-gray-100 text-gray-600">{payouts.length} payouts</span>
          </div>
          {payouts.length === 0 ? (
            <div className="text-center py-12">
              <IndianRupee className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No payouts yet. Earn commissions to get paid!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                    <th className="text-left px-6 py-3 font-medium">Date</th>
                    <th className="text-right px-6 py-3 font-medium">Amount</th>
                    <th className="text-left px-6 py-3 font-medium">Bank Account</th>
                    <th className="text-left px-6 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {payouts.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-gray-500">{formatDate(p.date)}</td>
                      <td className="px-6 py-4 text-right font-semibold text-gray-900">
                        ₹{(p.amount ?? 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-6 py-4 text-gray-600 font-mono">
                        ****{p.bank_last4}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`badge ${STATUS_BADGE[p.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
