'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { Shield, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { authApi } from '@/lib/api';
import { setToken, setUser } from '@/lib/auth';
import { Brand } from '@/components/ui';

declare global {
  interface Window {
    google?: { accounts: { id: { initialize: (c: { client_id: string; callback: (r: { credential: string }) => void }) => void; renderButton: (el: HTMLElement, c: Record<string, unknown>) => void } } };
  }
}

type LoginMethod = 'phone' | 'email';
type Step = 'input' | 'otp' | 'register';

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan',
  'Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
  'Delhi','Jammu & Kashmir','Ladakh',
];

const HERO_STATS = [['₹240Cr+','GMV liquidated'],['12,400+','live lots'],['74%','avg capital recovered']];

// 6-box OTP input
function OtpBoxes({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // Fixed-count refs — hooks rules compliant
  const r0 = useRef<HTMLInputElement>(null);
  const r1 = useRef<HTMLInputElement>(null);
  const r2 = useRef<HTMLInputElement>(null);
  const r3 = useRef<HTMLInputElement>(null);
  const r4 = useRef<HTMLInputElement>(null);
  const r5 = useRef<HTMLInputElement>(null);
  const refs = [r0, r1, r2, r3, r4, r5];
  const digits = value.padEnd(6, '').split('').slice(0, 6);

  function handleKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      const next = digits.slice(); next[i] = '';
      onChange(next.join('').trimEnd());
      if (i > 0) refs[i - 1].current?.focus();
    }
  }

  function handleInput(i: number, e: React.ChangeEvent<HTMLInputElement>) {
    const ch = e.target.value.replace(/\D/g, '').slice(-1);
    const next = digits.slice(); next[i] = ch;
    const joined = next.join('');
    onChange(joined);
    if (ch && i < 5) refs[i + 1].current?.focus();
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) { onChange(pasted); refs[Math.min(pasted.length, 5)].current?.focus(); }
    e.preventDefault();
  }

  return (
    <div className="flex gap-2.5 justify-center" onPaste={handlePaste}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={refs[i]}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[i] ?? ''}
          onChange={(e) => handleInput(i, e)}
          onKeyDown={(e) => handleKey(i, e)}
          className="text-center disp"
          style={{
            width: 52, height: 56, fontSize: 22, fontWeight: 700,
            borderRadius: 12,
            border: `1.5px solid ${digits[i] ? 'var(--nm-green)' : 'var(--nm-line)'}`,
            background: digits[i] ? 'var(--nm-green-soft)' : 'var(--nm-card)',
            color: 'var(--nm-ink)',
            outline: 'none',
            transition: 'border-color 0.15s',
          }}
        />
      ))}
    </div>
  );
}

function Countdown({ seconds }: { seconds: number }) {
  const [s, setS] = useState(seconds);
  useEffect(() => {
    if (s <= 0) return;
    const t = setTimeout(() => setS(p => p - 1), 1000);
    return () => clearTimeout(t);
  }, [s]);
  if (s <= 0) return null;
  return <span>Resend code in 0:{String(s).padStart(2, '0')}</span>;
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';

export default function LoginPage() {
  const router = useRouter();
  const [method, setMethod] = useState<LoginMethod>('email'); // email is default (free)
  const [step, setStep] = useState<Step>('input');
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [identifier, setIdentifier] = useState(''); // email or phone depending on method
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [userState, setUserState] = useState('');
  const [city, setCity] = useState('');
  const [resendKey, setResendKey] = useState(0);

  const isEmail = method === 'email';

  function redirect(role: string) {
    router.push(role === 'admin' ? '/admin' : role === 'seller' ? '/seller/dashboard' : '/dashboard');
  }

  // Google Sign-In handler
  const handleGoogleCredential = useCallback(async (response: { credential: string }) => {
    try {
      const res = await authApi.googleLogin(response.credential);
      const { access_token, refresh_token, user } = res.data.data;
      setToken(access_token, refresh_token);
      setUser(user as unknown as Parameters<typeof setUser>[0]);
      toast.success(`Welcome, ${user.name ?? 'there'}!`);
      redirect(user.role);
    } catch { toast.error('Google sign-in failed. Please try OTP instead.'); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const initGoogle = useCallback(() => {
    if (!window.google || !GOOGLE_CLIENT_ID || !googleBtnRef.current) return;
    window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCredential });
    window.google.accounts.id.renderButton(googleBtnRef.current, {
      theme: 'outline', size: 'large', text: 'continue_with', shape: 'rectangular', width: 340,
    });
  }, [handleGoogleCredential]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (isEmail) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) { toast.error('Enter a valid email address'); return; }
    } else {
      if (!/^[6-9]\d{9}$/.test(identifier)) { toast.error('Enter a valid 10-digit mobile number'); return; }
    }
    setLoading(true);
    try {
      if (isEmail) {
        await authApi.sendEmailOtp(identifier);
        toast.success(`OTP sent to ${identifier}`);
      } else {
        await authApi.sendOtp(identifier);
        toast.success(`OTP sent to +91 ${identifier}`);
      }
      setStep('otp');
      setResendKey(k => k + 1);
    } catch { toast.error('Failed to send OTP. Please try again.'); }
    finally { setLoading(false); }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length !== 6) { toast.error('Enter the 6-digit OTP'); return; }
    setLoading(true);
    try {
      if (isEmail) {
        const res = await authApi.verifyEmailOtp(identifier, otp);
        const { access_token, refresh_token, user } = res.data.data;
        setToken(access_token, refresh_token);
        setUser(user as unknown as Parameters<typeof setUser>[0]);
        toast.success(`Welcome, ${user.name ?? 'there'}!`);
        redirect(user.role);
      } else {
        const res = await authApi.verifyOtp(identifier, otp);
        const { registered, access_token, refresh_token, user } = res.data.data;
        if (registered && access_token && user) {
          setToken(access_token, refresh_token);
          setUser(user);
          redirect(user.role);
        } else {
          setStep('register');
        }
      }
    } catch { toast.error('Invalid OTP. Please try again.'); }
    finally { setLoading(false); }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !userState || !city.trim()) { toast.error('All fields are required'); return; }
    setLoading(true);
    try {
      const res = await authApi.registerBuyer({ phone: identifier, name: name.trim(), state: userState, city: city.trim(), otp_verified_phone: identifier });
      const { access_token, refresh_token, user } = res.data.data;
      setToken(access_token, refresh_token);
      setUser(user);
      router.push('/dashboard');
    } catch { toast.error('Registration failed. Please try again.'); }
    finally { setLoading(false); }
  }

  function switchMethod(m: LoginMethod) {
    setMethod(m); setStep('input'); setIdentifier(''); setOtp('');
  }

  return (
    <>
    {/* Google Identity Services SDK */}
    {GOOGLE_CLIENT_ID && (
      <Script
        src="https://accounts.google.com/gsi/client"
        onLoad={initGoogle}
        strategy="afterInteractive"
      />
    )}
    <div className="min-h-screen flex" style={{ background: 'var(--nm-paper)' }}>
      {/* ── Left pane (deep) ────────────────────────────────────────── */}
      <div
        className="hidden lg:flex flex-col justify-between relative overflow-hidden"
        style={{ width: '42%', background: 'var(--nm-deep)', padding: '48px 52px', color: '#fff' }}
      >
        {/* blobs */}
        <div style={{ position: 'absolute', right: -60, top: -60, width: 260, height: 260, borderRadius: '50%', background: 'rgba(244,168,42,.12)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', left: -40, bottom: -80, width: 200, height: 200, borderRadius: '50%', background: 'rgba(47,128,73,.18)', pointerEvents: 'none' }} />

        <div className="relative z-10">
          <Brand light size={22} />
        </div>
        <div className="relative z-10">
          <h1 className="disp" style={{ fontSize: 36, fontWeight: 800, lineHeight: 1.08, margin: '0 0 16px', letterSpacing: '-0.02em' }}>
            Welcome back<br />to the mandi.
          </h1>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,.65)', lineHeight: 1.55, maxWidth: 340, marginBottom: 40 }}>
            India's only escrow-protected B2B dead-stock liquidation platform.
          </p>
          <div className="flex flex-col gap-4">
            {HERO_STATS.map(([v, k]) => (
              <div key={k} className="flex items-center gap-4">
                <span className="num" style={{ fontSize: 24, fontWeight: 800, color: '#f4a82a', minWidth: 90 }}>{v}</span>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,.6)' }}>{k}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="relative z-10 flex items-center gap-2" style={{ fontSize: 12, color: 'rgba(255,255,255,.4)' }}>
          <Shield size={14} />
          Escrow by RazorpayX · Logistics by Delhivery
        </div>
      </div>

      {/* ── Right pane ─────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div style={{ width: '100%', maxWidth: 420 }}>

          {/* ── Input step ── */}
          {step === 'input' && (
            <form onSubmit={handleSend}>
              <h2 className="disp" style={{ fontSize: 28, fontWeight: 700, margin: '0 0 6px', color: 'var(--nm-ink)' }}>Sign in</h2>
              <p style={{ fontSize: 14, color: 'var(--nm-muted)', margin: '0 0 24px' }}>
                {isEmail ? "We'll send a one-time code to your email" : "We'll send a one-time code to your phone"}
              </p>

              {/* Method tabs */}
              <div className="flex gap-2 mb-6">
                {(['email', 'phone'] as LoginMethod[]).map(m => (
                  <button key={m} type="button" onClick={() => switchMethod(m)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                      method === m
                        ? 'border-green bg-green text-white' : 'border-line text-muted hover:border-green/40'
                    }`}
                    style={{
                      borderColor: method === m ? 'var(--nm-green)' : 'var(--nm-line)',
                      background: method === m ? 'var(--nm-green)' : 'transparent',
                      color: method === m ? '#fff' : 'var(--nm-muted)',
                    }}>
                    {m === 'email' ? '📧 Email' : '📱 Phone'}
                  </button>
                ))}
              </div>

              {/* Input field */}
              {isEmail ? (
                <div className="mb-6">
                  <label className="nm-label">Email address</label>
                  <input type="email" value={identifier} onChange={e => setIdentifier(e.target.value)}
                    placeholder="you@example.com" className="nm-input" autoFocus />
                  <p style={{ fontSize: 11.5, color: 'var(--nm-faint)', marginTop: 5 }}>
                    Free · Instant · No SMS cost
                  </p>
                </div>
              ) : (
                <div className="mb-6">
                  <label className="nm-label">Mobile number</label>
                  <div className="flex" style={{ gap: 0 }}>
                    <span className="flex items-center px-4 flex-shrink-0"
                      style={{ background: 'var(--nm-panel)', border: '1px solid var(--nm-line)', borderRight: 'none', borderRadius: '12px 0 0 12px', fontSize: 14, color: 'var(--nm-muted)', fontWeight: 600 }}>
                      🇮🇳 +91
                    </span>
                    <input type="tel" value={identifier}
                      onChange={e => setIdentifier(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="98765 43210" className="nm-input"
                      style={{ borderRadius: '0 12px 12px 0', borderLeft: 'none', flex: 1 }} autoFocus />
                  </div>
                </div>
              )}

              <button type="submit"
                disabled={loading || (isEmail ? identifier.length < 5 : identifier.length < 10)}
                className="nm-btn-primary w-full" style={{ padding: '14px', fontSize: 15 }}>
                {loading ? <><Loader2 size={16} className="animate-spin" /> Sending...</> : 'Send OTP'}
              </button>

              {/* Google divider + button */}
              {GOOGLE_CLIENT_ID && (
                <>
                  <div className="flex items-center gap-3" style={{ margin: '20px 0' }}>
                    <div style={{ flex: 1, height: 1, background: 'var(--nm-line)' }} />
                    <span style={{ fontSize: 12, color: 'var(--nm-faint)', fontWeight: 600 }}>OR</span>
                    <div style={{ flex: 1, height: 1, background: 'var(--nm-line)' }} />
                  </div>
                  <div ref={googleBtnRef} className="flex justify-center" />
                </>
              )}

              <p className="text-center mt-5" style={{ fontSize: 13, color: 'var(--nm-muted)' }}>
                New seller?{' '}
                <Link href="/seller-register" style={{ color: 'var(--nm-green)', fontWeight: 600 }}>
                  Register your business →
                </Link>
              </p>
            </form>
          )}

          {/* ── OTP step ── */}
          {step === 'otp' && (
            <form onSubmit={handleVerify}>
              <button type="button" onClick={() => setStep('input')}
                style={{ fontSize: 13, color: 'var(--nm-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 20px', display: 'flex', alignItems: 'center', gap: 6 }}>
                ← Back
              </button>
              <h2 className="disp" style={{ fontSize: 28, fontWeight: 700, margin: '0 0 8px', color: 'var(--nm-ink)' }}>Enter OTP</h2>
              <p style={{ fontSize: 14, color: 'var(--nm-muted)', margin: '0 0 32px' }}>
                Sent to {isEmail ? identifier : `+91 ${identifier}`}
              </p>
              <div className="mb-8"><OtpBoxes value={otp} onChange={setOtp} /></div>
              <p style={{ fontSize: 13, color: 'var(--nm-faint)', textAlign: 'center', marginBottom: 24 }}>
                <Countdown key={resendKey} seconds={24} />
              </p>
              <button type="submit" disabled={loading || otp.length !== 6}
                className="nm-btn-primary w-full" style={{ padding: '14px', fontSize: 15 }}>
                {loading ? <><Loader2 size={16} className="animate-spin" /> Verifying...</> : 'Verify & continue'}
              </button>
            </form>
          )}

          {/* ── Register step (phone only — email creates account immediately) ── */}
          {step === 'register' && (
            <form onSubmit={handleRegister}>
              <h2 className="disp" style={{ fontSize: 28, fontWeight: 700, margin: '0 0 8px', color: 'var(--nm-ink)' }}>One more step</h2>
              <p style={{ fontSize: 14, color: 'var(--nm-muted)', margin: '0 0 28px' }}>Tell us a bit about yourself</p>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="nm-label">Your name</label>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Rohan Mehta" className="nm-input" autoFocus />
                </div>
                <div>
                  <label className="nm-label">State</label>
                  <select value={userState} onChange={e => setUserState(e.target.value)} className="nm-select">
                    <option value="">Select state</option>
                    {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="nm-label">City</label>
                  <input value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Mumbai" className="nm-input" />
                </div>
              </div>
              <button type="submit" disabled={loading} className="nm-btn-primary w-full mt-6" style={{ padding: '14px', fontSize: 15 }}>
                {loading ? <><Loader2 size={16} className="animate-spin" /> Creating account...</> : 'Create account & continue'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
