'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { Brand } from '@/components/ui';
import { authApi } from '@/lib/api';
import { setToken, setUser } from '@/lib/auth';

const BENEFITS = [
  'Reach 8,000+ verified bulk buyers',
  'Escrow-protected payments',
  'List in minutes, get paid fast',
  'No upfront fees — pay only on success',
];

export default function SellerRegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email || !password) { toast.error('All fields required'); return; }
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      const res = await authApi.emailRegister({ email, password, name, role: 'seller' });
      const { access_token, refresh_token, user } = res.data.data;
      setToken(access_token, refresh_token);
      setUser(user as never);
      toast.success('Account created! Complete your profile to unlock payouts.');
      router.push('/seller/dashboard');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err?.response?.data?.error ?? 'Registration failed. Please try again.');
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--nm-paper)' }}>
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between relative overflow-hidden"
        style={{ width: '42%', background: 'var(--nm-deep)', padding: '48px 52px', color: '#fff' }}>
        <div style={{ position: 'absolute', right: -60, top: -60, width: 260, height: 260, borderRadius: '50%', background: 'rgba(244,168,42,.12)', pointerEvents: 'none' }} />
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
        <div style={{ width: '100%', maxWidth: 400 }}>
          <h1 className="disp" style={{ fontSize: 28, fontWeight: 800, color: 'var(--nm-ink)', margin: '0 0 8px' }}>Start selling</h1>
          <p style={{ fontSize: 14, color: 'var(--nm-muted)', margin: '0 0 28px' }}>
            Create your seller account — access dashboard instantly
          </p>

          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="nm-label">Your name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Rohan Mehta" className="nm-input" autoFocus />
            </div>
            <div>
              <label className="nm-label">Email address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="nm-input" />
            </div>
            <div>
              <label className="nm-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPw ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters"
                  className="nm-input" style={{ paddingRight: 42 }} />
                <button type="button" onClick={() => setShowPw(p => !p)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--nm-faint)' }}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p style={{ fontSize: 11.5, color: 'var(--nm-faint)', marginTop: 5 }}>Minimum 6 characters</p>
            </div>

            <button type="submit" disabled={loading} className="nm-btn-primary w-full" style={{ padding: '14px', fontSize: 15 }}>
              {loading ? <><Loader2 size={16} className="animate-spin" /> Creating account...</> : 'Create seller account →'}
            </button>
          </form>

          <div style={{ marginTop: 20 }} className="nm-card" style={{ padding: 16, marginTop: 20 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--nm-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>What happens next</p>
            {['Access seller dashboard immediately','Add listings and start selling','Complete business & bank details in Profile (for payouts)'].map((t, i) => (
              <div key={i} className="flex items-center gap-3" style={{ marginBottom: 7 }}>
                <span style={{ width: 20, height: 20, borderRadius: 999, background: 'var(--nm-green)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{i+1}</span>
                <span style={{ fontSize: 12.5, color: 'var(--nm-muted)' }}>{t}</span>
              </div>
            ))}
          </div>

          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--nm-muted)', marginTop: 16 }}>
            Already have an account?{' '}
            <Link href="/login" style={{ color: 'var(--nm-green)', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
