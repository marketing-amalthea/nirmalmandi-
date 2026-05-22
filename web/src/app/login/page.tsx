'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ShoppingBag, Phone, KeyRound, User, MapPin, Globe, Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { authApi } from '@/lib/api';
import { setToken, setUser } from '@/lib/auth';

type Step = 'phone' | 'otp' | 'register';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu & Kashmir', 'Ladakh',
];

const LANGUAGES = [
  { value: 'hi', label: 'Hindi' },
  { value: 'en', label: 'English' },
  { value: 'mr', label: 'Marathi' },
  { value: 'gu', label: 'Gujarati' },
  { value: 'ta', label: 'Tamil' },
  { value: 'te', label: 'Telugu' },
  { value: 'kn', label: 'Kannada' },
  { value: 'pa', label: 'Punjabi' },
  { value: 'bn', label: 'Bengali' },
];

export default function LoginPage() {
  const [step, setStep] = useState<Step>('phone');
  const [loading, setLoading] = useState(false);

  // Phone step
  const [phone, setPhone] = useState('');

  // OTP step
  const [otp, setOtp] = useState('');

  // Register step
  const [name, setName] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [language, setLanguage] = useState('en');

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[6-9]\d{9}$/.test(phone)) {
      toast.error('Enter a valid 10-digit Indian mobile number');
      return;
    }
    setLoading(true);
    try {
      await authApi.sendOtp(phone);
      toast.success('OTP sent to ' + phone);
      setStep('otp');
    } catch {
      toast.error('Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length !== 6) {
      toast.error('Enter the 6-digit OTP');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.verifyOtp(phone, otp);
      const { registered, access_token, refresh_token, user } = res.data.data;

      if (registered && access_token && user) {
        setToken(access_token, refresh_token);
        setUser(user);
        toast.success(`Welcome back, ${user.name}!`);
        window.location.href = '/dashboard';
      } else {
        // Not registered — go to registration form
        setStep('register');
      }
    } catch {
      toast.error('Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error('Name is required'); return; }
    if (!state) { toast.error('Please select your state'); return; }
    if (!city.trim()) { toast.error('City is required'); return; }
    setLoading(true);
    try {
      const res = await authApi.registerBuyer({
        phone,
        name: name.trim(),
        state,
        city: city.trim(),
        language_preference: language,
        otp_verified_phone: phone,
      });
      const { access_token, refresh_token, user } = res.data.data;
      setToken(access_token, refresh_token);
      setUser(user);
      toast.success(`Welcome to NirmalMandi, ${user.name}!`);
      window.location.href = '/dashboard';
    } catch {
      toast.error('Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-gray-100 flex flex-col">
      {/* Top bar */}
      <div className="p-4">
        <Link href="/" className="inline-flex items-center gap-2 text-primary-600 font-semibold text-sm hover:text-primary-700">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
              <ShoppingBag className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              Nirmal<span className="text-primary-600">Mandi</span>
            </h1>
            <p className="text-sm text-gray-500 mt-1">India&apos;s B2B Dead Inventory Marketplace</p>
          </div>

          {/* Card */}
          <div className="card p-6 shadow-md">
            {/* Step: Phone */}
            {step === 'phone' && (
              <>
                <h2 className="text-xl font-bold text-gray-900 mb-1">Login or Register</h2>
                <p className="text-sm text-gray-500 mb-6">Enter your mobile number to continue</p>
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mobile Number
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">+91</span>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="9876543210"
                        className="input-field pl-10"
                        inputMode="numeric"
                        required
                      />
                      <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                  <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-2.5">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {loading ? 'Sending OTP...' : 'Send OTP'}
                  </button>
                </form>
              </>
            )}

            {/* Step: OTP */}
            {step === 'otp' && (
              <>
                <button
                  onClick={() => setStep('phone')}
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
                >
                  <ArrowLeft className="w-3 h-3" /> Change number
                </button>
                <h2 className="text-xl font-bold text-gray-900 mb-1">Enter OTP</h2>
                <p className="text-sm text-gray-500 mb-6">
                  We sent a 6-digit OTP to <span className="font-semibold text-gray-700">+91 {phone}</span>
                </p>
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">6-digit OTP</label>
                    <div className="relative">
                      <input
                        type="tel"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="123456"
                        className="input-field text-center text-2xl tracking-widest font-bold"
                        inputMode="numeric"
                        required
                      />
                      <KeyRound className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                  <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-2.5">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {loading ? 'Verifying...' : 'Verify OTP'}
                  </button>
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    className="text-sm text-primary-600 hover:text-primary-700 w-full text-center font-medium"
                  >
                    Resend OTP
                  </button>
                </form>
              </>
            )}

            {/* Step: Register */}
            {step === 'register' && (
              <>
                <h2 className="text-xl font-bold text-gray-900 mb-1">Complete Registration</h2>
                <p className="text-sm text-gray-500 mb-6">
                  Just a few details to set up your buyer account
                </p>
                <form onSubmit={handleRegister} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Raj Kumar"
                        className="input-field"
                        required
                      />
                      <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                    <div className="relative">
                      <select
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        className="input-field appearance-none pr-8"
                        required
                      >
                        <option value="">Select state</option>
                        {INDIAN_STATES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Mumbai"
                      className="input-field"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Language</label>
                    <div className="relative">
                      <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="input-field appearance-none pr-8"
                      >
                        {LANGUAGES.map((l) => (
                          <option key={l.value} value={l.value}>{l.label}</option>
                        ))}
                      </select>
                      <Globe className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>

                  <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-2.5">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {loading ? 'Creating account...' : 'Create Buyer Account'}
                  </button>
                </form>
              </>
            )}
          </div>

          <p className="text-center text-xs text-gray-400 mt-4">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}
