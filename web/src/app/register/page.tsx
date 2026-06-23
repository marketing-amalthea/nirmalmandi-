'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { authApi } from '@/lib/api';
import { setToken, setUser } from '@/lib/auth';
import { Brand } from '@/components/ui';

export default function BuyerRegisterPage() {
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
      const res = await authApi.emailRegister({ email, password, name, role: 'buyer' });
      const { access_token, refresh_token, user } = res.data.data;
      setToken(access_token, refresh_token);
      setUser(user as never);
      toast.success(`Welcome, ${user.name}!`);
      router.push('/dashboard');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err?.response?.data?.error ?? 'Registration failed');
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--nm-paper)' }}>
      <div className="nm-card" style={{ width: '100%', maxWidth: 420, padding: 36, margin: 16 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <Brand size={20} />
          <h1 className="disp" style={{ fontSize: 22, fontWeight: 800, color: 'var(--nm-ink)', margin: '12px 0 4px' }}>Create buyer account</h1>
          <p style={{ fontSize: 13, color: 'var(--nm-muted)', margin: 0 }}>Browse and buy dead inventory deals</p>
        </div>

        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="nm-label">Full name</label>
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
          </div>
          <button type="submit" disabled={loading} className="nm-btn-primary w-full" style={{ padding: '13px', fontSize: 15, marginTop: 4 }}>
            {loading ? <><Loader2 size={16} className="animate-spin" /> Creating account...</> : 'Create buyer account →'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--nm-muted)', marginTop: 20 }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--nm-green)', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
        </p>
        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--nm-muted)', marginTop: 6 }}>
          Want to sell?{' '}
          <Link href="/seller-register" style={{ color: 'var(--nm-green)', fontWeight: 600, textDecoration: 'none' }}>Register as seller</Link>
        </p>
      </div>
    </div>
  );
}
