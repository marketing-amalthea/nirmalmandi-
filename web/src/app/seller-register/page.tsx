'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle, Package } from 'lucide-react';
import { toast } from 'sonner';
import { Brand } from '@/components/ui';
import api from '@/lib/api';
import { setToken, setUser } from '@/lib/auth';

/**
 * Seller quick registration — email OTP only.
 * No business details required upfront.
 * Dashboard is accessible immediately after signup.
 * Onboarding (business, GST, bank) lives in /seller/profile.
 */

function OtpBoxes({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const r = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];
  const digits = value.padEnd(6, '').split('').slice(0, 6);
  return (
    <div className="flex gap-2.5 justify-center">
      {Array.from({ length: 6 }).map((_, i) => (
        <input key={i} ref={r[i]} type="text" inputMode="numeric" maxLength={1}
          value={digits[i] ?? ''}
          onChange={e => {
            const ch = e.target.value.replace(/\D/g, '').slice(-1);
            const arr = value.padEnd(6, ' ').split(''); arr[i] = ch;
            onChange(arr.join('').trimEnd());
            if (ch && i < 5) r[i + 1].current?.focus();
          }}
          onKeyDown={e => {
            if (e.key === 'Backspace') {
              const arr = value.padEnd(6, ' ').split(''); arr[i] = '';
              onChange(arr.join('').trimEnd());
              if (i > 0) r[i - 1].current?.focus();
            }
          }}
          style={{
            width: 52, height: 58, textAlign: 'center', fontSize: 22, fontWeight: 700, borderRadius: 12,
            border: `2px solid ${digits[i] ? 'var(--nm-green)' : 'var(--nm-line)'}`,
            background: digits[i] ? 'var(--nm-green-soft)' : 'var(--nm-card)',
            color: 'var(--nm-ink)', outline: 'none', transition: 'border-color 0.15s',
          }} />
      ))}
    </div>
  );
}

export default function SellerRegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'otp' | 'done'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [loading, setLoading] = useState(false);

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast.error('Enter a valid email address'); return; }
    setLoading(true);
    try {
      const res = await api.post('/auth/email/otp/send', { email });
      const tok = (res.data as { data?: { token?: string } })?.data?.token ?? '';
      setOtpToken(tok);
      setStep('otp');
      toast.success(`OTP sent to ${email}`);
    } catch { toast.error('Failed to send OTP. Please try again.'); }
    finally { setLoading(false); }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    const code = otp.replace(/\s/g, '');
    if (code.length !== 6) { toast.error('Enter the 6-digit OTP'); return; }
    setLoading(true);
    try {
      // Verify email OTP — creates seller account if new user
      const res = await api.post('/auth/email/otp/verify', { email, otp: code, token: otpToken });
      const { access_token, refresh_token, user } = res.data?.data ?? {};
      if (!access_token) throw new Error('No token');

      // If user came back as buyer, upgrade to seller on the server
      let finalUser = user;
      if (user?.role !== 'seller') {
        try {
          // Create a minimal seller profile — details filled in profile later
          const sellerRes = await api.post('/auth/seller/quick-register', {
            email,
            business_name: email.split('@')[0], // temp name, updatable in profile
          }, { headers: { Authorization: `Bearer ${access_token}` } });
          finalUser = sellerRes.data?.data?.user ?? user;
        } catch {
          // If endpoint doesn't exist yet, proceed anyway — profile will handle it
        }
      }

      setToken(access_token, refresh_token);
      setUser({ ...finalUser, role: 'seller' });
      setStep('done');
      setTimeout(() => router.push('/seller/dashboard'), 1500);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string; message?: string } } };
      const msg = err?.response?.data?.error ?? err?.response?.data?.message ?? 'OTP verification failed';
      toast.error(msg);
    }
    finally { setLoading(false); }
  }

  const BENEFITS = [
    'Reach 8,000+ verified bulk buyers',
    'Escrow-protected payments',
    'List in minutes, get paid fast',
    'No upfront fees — pay only on success',
  ];

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--nm-paper)' }}>
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between relative overflow-hidden"
        style={{ width: '42%', background: 'var(--nm-deep)', padding: '48px 52px', color: '#fff' }}>
        <div style={{ position: 'absolute', right: -60, top: -60, width: 260, height: 260, borderRadius: '50%', background: 'rgba(244,168,42,.12)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', left: -40, bottom: -80, width: 200, height: 200, borderRadius: '50%', background: 'rgba(47,128,73,.18)', pointerEvents: 'none' }} />
        <div className="relative z-10"><Brand light size={22} /></div>
        <div className="relative z-10">
          <h2 className="disp" style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.1, margin: '0 0 16px', letterSpacing: '-0.02em' }}>
            Turn dead stock<br /><span style={{ color: '#f4a82a' }}>into working capital.</span>
          </h2>
          <div className="flex flex-col gap-3 mt-6">
            {BENEFITS.map(b => (
              <div key={b} className="flex items-center gap-2.5">
                <CheckCircle size={16} style={{ color: '#f4a82a', flexShrink: 0 }} />
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,.8)' }}>{b}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="relative z-10" style={{ fontSize: 12, color: 'rgba(255,255,255,.4)' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: '#f4a82a', textDecoration: 'none' }}>Sign in →</Link>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div style={{ width: '100%', maxWidth: 420 }}>

          {step === 'done' ? (
            <div className="text-center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 72, height: 72, borderRadius: 999, background: 'var(--nm-green-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle size={36} style={{ color: 'var(--nm-green)' }} />
              </div>
              <h2 className="disp" style={{ fontSize: 24, fontWeight: 800, color: 'var(--nm-ink)', margin: 0 }}>You're in!</h2>
              <p style={{ fontSize: 14, color: 'var(--nm-muted)', margin: 0 }}>
                Taking you to your seller dashboard…
              </p>
              <Loader2 size={20} className="animate-spin" style={{ color: 'var(--nm-green)' }} />
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 32 }}>
                <h1 className="disp" style={{ fontSize: 28, fontWeight: 800, color: 'var(--nm-ink)', margin: '0 0 8px' }}>
                  Start selling
                </h1>
                <p style={{ fontSize: 14, color: 'var(--nm-muted)', margin: 0 }}>
                  {step === 'email'
                    ? 'Enter your email — we\'ll send you a one-time code to get started.'
                    : `We sent a 6-digit code to ${email}`}
                </p>
              </div>

              {step === 'email' ? (
                <form onSubmit={sendOtp} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label className="nm-label">Email address</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com" className="nm-input" autoFocus />
                    <p style={{ fontSize: 11.5, color: 'var(--nm-faint)', marginTop: 5 }}>
                      No phone number needed · Free to join · OTP via email
                    </p>
                  </div>
                  <button type="submit" disabled={loading || email.length < 5} className="nm-btn-primary w-full" style={{ padding: '14px', fontSize: 15 }}>
                    {loading ? <><Loader2 size={16} className="animate-spin" /> Sending...</> : 'Continue with email →'}
                  </button>
                  <p className="text-center" style={{ fontSize: 13, color: 'var(--nm-muted)' }}>
                    Already have an account?{' '}
                    <Link href="/login" style={{ color: 'var(--nm-green)', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
                  </p>
                </form>
              ) : (
                <form onSubmit={verifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <OtpBoxes value={otp} onChange={setOtp} />
                  <button type="submit" disabled={loading || otp.replace(/\s/g,'').length !== 6}
                    className="nm-btn-primary w-full" style={{ padding: '14px', fontSize: 15 }}>
                    {loading ? <><Loader2 size={16} className="animate-spin" /> Verifying...</> : 'Create my seller account →'}
                  </button>
                  <button type="button" onClick={() => { setStep('email'); setOtp(''); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--nm-muted)' }}>
                    ← Change email
                  </button>
                </form>
              )}

              {/* What happens next */}
              {step === 'email' && (
                <div className="nm-card" style={{ marginTop: 28, padding: 18 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--nm-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px' }}>
                    What happens next
                  </p>
                  {[
                    ['1', 'Verify email — takes 30 seconds'],
                    ['2', 'Access your seller dashboard immediately'],
                    ['3', 'Complete business details in Profile (optional to start)'],
                  ].map(([n, t]) => (
                    <div key={n} className="flex items-center gap-3" style={{ marginBottom: 8 }}>
                      <span style={{ width: 22, height: 22, borderRadius: 999, background: 'var(--nm-green)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{n}</span>
                      <span style={{ fontSize: 13, color: 'var(--nm-muted)' }}>{t}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
