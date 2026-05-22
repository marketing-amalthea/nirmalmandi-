'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function sendOtp() {
    setLoading(true); setError('');
    try {
      await api.post('/auth/otp/send', { phone });
      setStep('otp');
    } catch { setError('Failed to send OTP'); }
    finally { setLoading(false); }
  }

  async function verifyOtp() {
    setLoading(true); setError('');
    try {
      const res = await api.post('/auth/otp/verify', { phone, otp });
      const token = res.data?.data?.access_token;
      const user = res.data?.data?.user;
      if (!token) {
        setError('Login failed: no token received.');
        return;
      }
      localStorage.setItem('nm_admin_token', token);
      if (user) localStorage.setItem('nm_admin_user', JSON.stringify(user));
      window.location.href = '/';
    } catch {
      setError('Invalid OTP or server error.');
    }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-nm-surface flex items-center justify-center" data-mode="light">
      <div className="bg-white rounded-2xl shadow-xl p-10 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-nm-primary">NirmalMandi</h1>
          <p className="text-nm-muted mt-1">Admin Console</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">
            {error}
          </div>
        )}

        {step === 'phone' ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-nm-text mb-1">Admin Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+919876543210"
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-nm-primary"
              />
            </div>
            <button
              onClick={sendOtp}
              disabled={loading || phone.length < 10}
              className="w-full bg-nm-primary text-white rounded-lg py-3 font-semibold hover:bg-nm-primary/90 disabled:opacity-50 transition"
            >
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-nm-muted">OTP sent to {phone}</p>
            <div>
              <label className="block text-sm font-medium text-nm-text mb-1">Enter OTP</label>
              <input
                type="text"
                value={otp}
                onChange={e => setOtp(e.target.value)}
                placeholder="6-digit OTP"
                maxLength={6}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-nm-primary"
              />
            </div>
            <button
              onClick={verifyOtp}
              disabled={loading || otp.length !== 6}
              className="w-full bg-nm-primary text-white rounded-lg py-3 font-semibold hover:bg-nm-primary/90 disabled:opacity-50 transition"
            >
              {loading ? 'Verifying...' : 'Login'}
            </button>
            <button onClick={() => setStep('phone')} className="w-full text-sm text-nm-muted hover:text-nm-primary">
              Change number
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
