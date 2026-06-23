'use client';
import { useState, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import api from '@/lib/api';

function OtpRow({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const refs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];
  const digits = value.padEnd(6, '').split('').slice(0, 6);
  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input key={i} ref={refs[i]} type="text" inputMode="numeric" maxLength={1}
          value={digits[i] ?? ''}
          onChange={e => {
            const ch = e.target.value.replace(/\D/g, '').slice(-1);
            const arr = value.padEnd(6, ' ').split(''); arr[i] = ch;
            onChange(arr.join('').trimEnd());
            if (ch && i < 5) refs[i + 1].current?.focus();
          }}
          onKeyDown={e => {
            if (e.key === 'Backspace') {
              const arr = value.padEnd(6, ' ').split(''); arr[i] = '';
              onChange(arr.join('').trimEnd());
              if (i > 0) refs[i - 1].current?.focus();
            }
          }}
          style={{
            width: 48, height: 56, textAlign: 'center', fontSize: 22, fontWeight: 700,
            borderRadius: 12, border: `2px solid ${digits[i] ? 'var(--nm-green)' : 'var(--nm-line)'}`,
            background: digits[i] ? 'var(--nm-green-soft)' : 'var(--nm-card)',
            color: 'var(--nm-ink)', outline: 'none',
          }} />
      ))}
    </div>
  );
}

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function sendOtp() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Enter a valid email address'); return; }
    setLoading(true); setError('');
    try {
      const sendRes = await api.post('/auth/email/otp/send', { email });
      const tok = (sendRes.data as { data?: { token?: string } })?.data?.token ?? '';
      setOtpToken(tok);
      setStep('otp');
    } catch { setError('Failed to send OTP. Please try again.'); }
    finally { setLoading(false); }
  }

  async function verifyOtp() {
    if (otp.replace(/\s/g, '').length !== 6) { setError('Enter the 6-digit OTP'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.post('/auth/email/otp/verify', { email, otp: otp.replace(/\s/g, ''), token: otpToken });
      const token = res.data?.data?.access_token;
      const user = res.data?.data?.user;
      if (!token) { setError('Login failed. Please try again.'); return; }
      if (user?.role !== 'admin') { setError('Access denied — admin accounts only.'); return; }
      localStorage.setItem('nm_admin_token', token);
      if (user) localStorage.setItem('nm_admin_user', JSON.stringify(user));
      window.location.href = '/';
    } catch { setError('Invalid OTP. Please try again.'); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--nm-deep)', position: 'relative', overflow: 'hidden' }}>
      {/* blobs */}
      <div style={{ position: 'absolute', right: -80, top: -80, width: 320, height: 320, borderRadius: '50%', background: 'rgba(244,168,42,.1)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', left: -60, bottom: -80, width: 240, height: 240, borderRadius: '50%', background: 'rgba(47,128,73,.15)', pointerEvents: 'none' }} />

      <div className="nm-card relative" style={{ width: '100%', maxWidth: 420, padding: 36, margin: 16 }}>
        {/* Logo */}
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
          <p style={{ fontSize: 13, color: 'var(--nm-muted)', marginTop: 6 }}>Restricted access · OTP verification required</p>
        </div>

        {error && (
          <div style={{ background: 'var(--nm-red-soft)', border: '1px solid rgba(182,68,42,.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: 'var(--nm-red)' }}>
            {error}
          </div>
        )}

        {step === 'email' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="nm-label">Admin email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendOtp()}
                placeholder="marketing.amalthea@gmail.com"
                className="nm-input" autoFocus />
            </div>
            <button onClick={sendOtp} disabled={loading || email.length < 5} className="nm-btn-primary w-full" style={{ padding: '14px', fontSize: 15 }}>
              {loading ? <><Loader2 size={16} className="animate-spin" /> Sending...</> : 'Send OTP →'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 13, color: 'var(--nm-muted)', textAlign: 'center', margin: 0 }}>
              OTP sent to <strong style={{ color: 'var(--nm-ink)' }}>{email}</strong>
            </p>
            <OtpRow value={otp} onChange={setOtp} />
            <button onClick={verifyOtp} disabled={loading || otp.replace(/\s/g,'').length !== 6}
              className="nm-btn-primary w-full" style={{ padding: '14px', fontSize: 15 }}>
              {loading ? <><Loader2 size={16} className="animate-spin" /> Verifying...</> : 'Verify & Enter Console'}
            </button>
            <button onClick={() => { setStep('email'); setOtp(''); setError(''); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--nm-muted)' }}>
              ← Change email
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
