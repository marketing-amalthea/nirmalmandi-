'use client';

import { useState } from 'react';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import api from '@/lib/api';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) { setError('Email and password required'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.post('/auth/email/login', { email, password });
      const { access_token, user } = res.data?.data ?? {};
      if (!access_token) { setError('Login failed'); return; }
      if (user?.role !== 'admin') { setError('Access denied — admin accounts only'); return; }
      localStorage.setItem('nm_admin_token', access_token);
      localStorage.setItem('nm_admin_user', JSON.stringify(user));
      window.location.href = '/';
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err?.response?.data?.error ?? 'Invalid email or password');
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--nm-deep)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', right: -80, top: -80, width: 320, height: 320, borderRadius: '50%', background: 'rgba(244,168,42,.1)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', left: -60, bottom: -80, width: 240, height: 240, borderRadius: '50%', background: 'rgba(47,128,73,.15)', pointerEvents: 'none' }} />

      <div className="nm-card relative" style={{ width: '100%', maxWidth: 400, padding: 36, margin: 16 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--nm-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', boxShadow: '0 2px 0 rgba(0,0,0,.12)' }}>
            <span style={{ fontSize: 22 }}>🏪</span>
          </div>
          <h1 className="disp" style={{ fontSize: 22, fontWeight: 800, color: 'var(--nm-ink)', margin: 0 }}>
            Nirmal<span style={{ color: 'var(--nm-green)' }}>Mandi</span>
          </h1>
          <span className="nm-pill" style={{ background: 'var(--nm-green-soft)', color: 'var(--nm-green)', fontWeight: 700, fontSize: 11, marginTop: 6, display: 'inline-flex' }}>
            Admin Console
          </span>
        </div>

        {error && (
          <div style={{ background: 'var(--nm-red-soft)', border: '1px solid rgba(182,68,42,.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: 'var(--nm-red)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="nm-label">Admin email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="marketing.amalthea@gmail.com" className="nm-input" autoFocus />
          </div>
          <div>
            <label className="nm-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input type={showPw ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                className="nm-input" style={{ paddingRight: 42 }} />
              <button type="button" onClick={() => setShowPw(p => !p)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--nm-faint)' }}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading} className="nm-btn-primary w-full" style={{ padding: '13px', fontSize: 15, marginTop: 4 }}>
            {loading ? <><Loader2 size={16} className="animate-spin" /> Signing in...</> : 'Sign in →'}
          </button>
        </form>
      </div>
    </div>
  );
}
