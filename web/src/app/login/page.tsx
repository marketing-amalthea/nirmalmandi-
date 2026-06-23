'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { authApi } from '@/lib/api';
import { setToken, setUser } from '@/lib/auth';
import { Brand } from '@/components/ui';

const HERO_STATS = [['₹240Cr+','GMV liquidated'],['12,400+','live lots'],['74%','avg capital recovered']];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  function redirect(role: string) {
    router.push(role === 'admin' ? '/admin' : role === 'seller' ? '/seller/dashboard' : '/dashboard');
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) { toast.error('Enter email and password'); return; }
    setLoading(true);
    try {
      const res = await authApi.emailLogin(email, password);
      const { access_token, refresh_token, user } = res.data.data;
      setToken(access_token, refresh_token);
      setUser(user as never);
      toast.success(`Welcome back, ${user.name}!`);
      redirect(user.role);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err?.response?.data?.error ?? 'Invalid email or password');
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--nm-paper)' }}>
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between relative overflow-hidden"
        style={{ width: '42%', background: 'var(--nm-deep)', padding: '48px 52px', color: '#fff' }}>
        <div style={{ position: 'absolute', right: -60, top: -60, width: 260, height: 260, borderRadius: '50%', background: 'rgba(244,168,42,.12)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', left: -40, bottom: -80, width: 200, height: 200, borderRadius: '50%', background: 'rgba(47,128,73,.18)', pointerEvents: 'none' }} />
        <div className="relative z-10"><Brand light size={22} /></div>
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
        <div className="relative z-10" style={{ fontSize: 12, color: 'rgba(255,255,255,.4)' }}>
          Escrow by RazorpayX · Logistics by Delhivery
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div style={{ width: '100%', maxWidth: 400 }}>
          <h2 className="disp" style={{ fontSize: 28, fontWeight: 800, color: 'var(--nm-ink)', margin: '0 0 8px' }}>Sign in</h2>
          <p style={{ fontSize: 14, color: 'var(--nm-muted)', margin: '0 0 28px' }}>Enter your email and password to continue</p>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="nm-label">Email address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" className="nm-input" autoFocus />
            </div>
            <div>
              <label className="nm-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPw ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" className="nm-input" style={{ paddingRight: 42 }} />
                <button type="button" onClick={() => setShowPw(p => !p)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--nm-faint)' }}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="nm-btn-primary w-full" style={{ padding: '14px', fontSize: 15, marginTop: 4 }}>
              {loading ? <><Loader2 size={16} className="animate-spin" /> Signing in...</> : 'Sign in →'}
            </button>
          </form>

          <div style={{ margin: '20px 0', textAlign: 'center', fontSize: 13, color: 'var(--nm-muted)' }}>
            Don't have an account?{' '}
            <Link href="/seller-register" style={{ color: 'var(--nm-green)', fontWeight: 600, textDecoration: 'none' }}>
              Register as seller
            </Link>
            {' · '}
            <Link href="/register" style={{ color: 'var(--nm-green)', fontWeight: 600, textDecoration: 'none' }}>
              Register as buyer
            </Link>
          </div>

          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--nm-faint)' }}>
            <Link href="/forgot-password" style={{ color: 'var(--nm-faint)', textDecoration: 'none' }}>Forgot password?</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
