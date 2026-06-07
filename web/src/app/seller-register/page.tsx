'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  ShoppingBag,
  ArrowLeft,
  Phone,
  KeyRound,
  Building2,
  MapPin,
  CreditCard,
  FileText,
  Check,
  Loader2,
  AlertCircle,
  CheckCircle,
  Upload,
  RefreshCw,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import api, { authApi } from '@/lib/api';
import { setToken, setUser } from '@/lib/auth';

// ── Types ──────────────────────────────────────────────────────────────────────
interface UploadedDoc {
  file: File | null;
  status: 'idle' | 'uploading' | 'done' | 'error';
  fileUrl: string;
  progress: number;
}

const INITIAL_DOC: UploadedDoc = { file: null, status: 'idle', fileUrl: '', progress: 0 };

// ── Constants ──────────────────────────────────────────────────────────────────
const STEPS = [
  'Phone & OTP',
  'Business Details',
  'Address',
  'Bank Account',
  'Documents',
];

const BUSINESS_TYPES = [
  { value: 'manufacturer', label: 'Manufacturer' },
  { value: 'distributor', label: 'Distributor' },
  { value: 'retailer', label: 'Retailer' },
  { value: 'wholesaler', label: 'Wholesaler' },
];

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu & Kashmir', 'Ladakh',
];

const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const OTP_RESEND_SECONDS = 60;

// ── Helpers ────────────────────────────────────────────────────────────────────
function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
      <AlertCircle className="w-3 h-3 flex-shrink-0" />{msg}
    </p>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function SellerRegisterPage() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [completed, setCompleted] = useState(false);

  // Step 1 — Phone & OTP
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Step 2 — Business Details
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [msmeNumber, setMsmeNumber] = useState('');

  // Step 3 — Business Address
  const [bizLine1, setBizLine1] = useState('');
  const [bizLine2, setBizLine2] = useState('');
  const [bizCity, setBizCity] = useState('');
  const [bizState, setBizState] = useState('');
  const [bizPincode, setBizPincode] = useState('');
  const [warehouseSame, setWarehouseSame] = useState(true);
  const [whLine1, setWhLine1] = useState('');
  const [whLine2, setWhLine2] = useState('');
  const [whCity, setWhCity] = useState('');
  const [whState, setWhState] = useState('');
  const [whPincode, setWhPincode] = useState('');

  // Step 4 — Bank
  const [accountHolder, setAccountHolder] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [bankVerified, setBankVerified] = useState(false);
  const [bankVerifying, setBankVerifying] = useState(false);

  // Step 5 — Documents
  const [gstCert, setGstCert] = useState<UploadedDoc>({ ...INITIAL_DOC });
  const [panCard, setPanCard] = useState<UploadedDoc>({ ...INITIAL_DOC });
  const [addressProof, setAddressProof] = useState<UploadedDoc>({ ...INITIAL_DOC });
  const [agreed, setAgreed] = useState(false);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  function startResendTimer() {
    setResendTimer(OTP_RESEND_SECONDS);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  }

  function clearError(key: string) {
    setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  }

  // ── OTP handlers ──────────────────────────────────────────────────────────────
  async function handleSendOtp() {
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setErrors({ phone: 'Enter a valid 10-digit Indian mobile number' });
      return;
    }
    clearError('phone');
    setLoading(true);
    try {
      await authApi.sendOtp(phone);
      toast.success('OTP sent to +91 ' + phone);
      setOtpSent(true);
      startResendTimer();
    } catch {
      toast.error('Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    if (otp.length !== 6) {
      setErrors({ otp: 'Enter the 6-digit OTP' });
      return;
    }
    clearError('otp');
    setLoading(true);
    try {
      const res = await authApi.verifyOtp(phone, otp);
      const { registered, access_token, refresh_token, user } = res.data.data;
      if (registered && access_token && user && user.role === 'seller') {
        setToken(access_token, refresh_token);
        setUser(user);
        toast.success('Welcome back!');
        window.location.href = '/seller/dashboard';
        return;
      }
      // Not registered as seller — continue
      setStep(1);
    } catch {
      toast.error('Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2 validation ────────────────────────────────────────────────────────
  function validateStep2(): boolean {
    const errs: Record<string, string> = {};
    if (!businessName.trim()) errs.businessName = 'Business name is required';
    if (!businessType) errs.businessType = 'Please select a business type';
    if (!gstNumber.trim()) {
      errs.gstNumber = 'GST number is required';
    } else if (!GST_REGEX.test(gstNumber.trim().toUpperCase())) {
      errs.gstNumber = 'Invalid GST format (e.g. 27AAPFU0939F1ZV)';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Step 3 validation ────────────────────────────────────────────────────────
  function validateStep3(): boolean {
    const errs: Record<string, string> = {};
    if (!bizLine1.trim()) errs.bizLine1 = 'Address is required';
    if (!bizCity.trim()) errs.bizCity = 'City is required';
    if (!bizState) errs.bizState = 'Please select a state';
    if (!/^\d{6}$/.test(bizPincode)) errs.bizPincode = 'Enter a valid 6-digit pincode';

    if (!warehouseSame) {
      if (!whLine1.trim()) errs.whLine1 = 'Warehouse address is required';
      if (!whCity.trim()) errs.whCity = 'City is required';
      if (!whState) errs.whState = 'Please select a state';
      if (!/^\d{6}$/.test(whPincode)) errs.whPincode = 'Enter a valid 6-digit pincode';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Step 4 validation ────────────────────────────────────────────────────────
  function validateStep4(): boolean {
    const errs: Record<string, string> = {};
    if (!accountHolder.trim()) errs.accountHolder = 'Account holder name is required';
    if (!accountNumber.trim()) errs.accountNumber = 'Account number is required';
    if (!ifsc.trim()) {
      errs.ifsc = 'IFSC code is required';
    } else if (!IFSC_REGEX.test(ifsc.trim().toUpperCase())) {
      errs.ifsc = 'Invalid IFSC format (e.g. SBIN0001234)';
    }
    if (!bankVerified) errs.bankVerify = 'Please verify your bank account before proceeding';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Bank verification ────────────────────────────────────────────────────────
  async function handleVerifyBank() {
    if (!accountNumber.trim()) { setErrors({ accountNumber: 'Account number is required' }); return; }
    if (!IFSC_REGEX.test(ifsc.trim().toUpperCase())) { setErrors({ ifsc: 'Invalid IFSC format' }); return; }
    setBankVerifying(true);
    try {
      await api.post('/auth/verify-bank', {
        account_number: accountNumber.trim(),
        ifsc: ifsc.trim().toUpperCase(),
      });
      setBankVerified(true);
      clearError('bankVerify');
      toast.success('Account Verified!');
    } catch {
      toast.error('Bank verification failed. Please check the details.');
    } finally {
      setBankVerifying(false);
    }
  }

  // ── Document upload ───────────────────────────────────────────────────────────
  async function uploadDocument(
    file: File,
    type: string,
    setter: React.Dispatch<React.SetStateAction<UploadedDoc>>
  ) {
    setter((prev) => ({ ...prev, file, status: 'uploading', progress: 0 }));
    try {
      const res = await api.get<{ data: { uploadUrl: string; fileUrl: string } }>(
        '/auth/kyc-upload-url',
        { params: { type } }
      );
      const { uploadUrl, fileUrl } = (res.data as unknown as { data: { uploadUrl: string; fileUrl: string } })?.data ?? res.data;

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl, true);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setter((prev) => ({ ...prev, progress: Math.round((e.loaded / e.total) * 100) }));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed: ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.send(file);
      });

      setter((prev) => ({ ...prev, status: 'done', fileUrl, progress: 100 }));
    } catch {
      setter((prev) => ({ ...prev, status: 'error', progress: 0 }));
      toast.error(`Failed to upload ${type}`);
    }
  }

  function handleDocFile(
    e: React.ChangeEvent<HTMLInputElement>,
    type: string,
    setter: React.Dispatch<React.SetStateAction<UploadedDoc>>
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) {
      toast.error('Only JPG, PNG, or PDF files are allowed');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File must be under 5MB');
      return;
    }
    uploadDocument(file, type, setter);
    e.target.value = '';
  }

  // ── Step 5 validation ────────────────────────────────────────────────────────
  function validateStep5(): boolean {
    const errs: Record<string, string> = {};
    if (gstCert.status !== 'done') errs.gstCert = 'Please upload GST Certificate';
    if (panCard.status !== 'done') errs.panCard = 'Please upload PAN Card';
    if (addressProof.status !== 'done') errs.addressProof = 'Please upload Address Proof';
    if (!agreed) errs.agreed = 'Please accept the Seller Agreement to continue';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Final submit ──────────────────────────────────────────────────────────────
  async function handleComplete() {
    if (!validateStep5()) return;
    setLoading(true);
    try {
      const res = await api.post<{ data: { access_token: string; refresh_token?: string; user: import('@/lib/auth').AuthUser } }>(
        '/auth/register/seller',
        {
          phone,
          business_name: businessName.trim(),
          business_type: businessType,
          gst_number: gstNumber.trim().toUpperCase(),
          pan_number: panNumber.trim().toUpperCase() || undefined,
          msme_number: msmeNumber.trim() || undefined,
          address_line1: bizLine1.trim(),
          address_line2: bizLine2.trim() || undefined,
          city: bizCity.trim(),
          state: bizState,
          pincode: bizPincode,
          warehouse_same_as_business: warehouseSame,
          warehouse_address_line1: !warehouseSame ? whLine1.trim() : undefined,
          warehouse_address_line2: !warehouseSame ? whLine2.trim() : undefined,
          warehouse_city: !warehouseSame ? whCity.trim() : undefined,
          warehouse_state: !warehouseSame ? whState : undefined,
          warehouse_pincode: !warehouseSame ? whPincode : undefined,
          account_holder_name: accountHolder.trim(),
          bank_account_number: accountNumber.trim(),
          ifsc: ifsc.trim().toUpperCase(),
          gst_certificate_url: gstCert.fileUrl,
          pan_card_url: panCard.fileUrl,
          address_proof_url: addressProof.fileUrl,
          otp_verified_phone: phone,
          language_preference: 'en',
          name: accountHolder.trim(),
        }
      );
      const payload = (res.data as unknown as { data: { access_token: string; refresh_token?: string; user: import('@/lib/auth').AuthUser } })?.data ?? res.data;
      if (payload.access_token && payload.user) {
        setToken(payload.access_token, payload.refresh_token);
        setUser(payload.user);
      }
      setCompleted(true);
    } catch {
      toast.error('Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Navigation ────────────────────────────────────────────────────────────────
  function handleNext() {
    if (step === 1 && !validateStep2()) return;
    if (step === 2 && !validateStep3()) return;
    if (step === 3 && !validateStep4()) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    setErrors({});
  }

  // ── Doc upload widget (render helper, not a component) ───────────────────────
  function renderDocUpload(
    label: string,
    doc: UploadedDoc,
    type: string,
    setter: React.Dispatch<React.SetStateAction<UploadedDoc>>,
    inputId: string,
    errorKey: string
  ) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <div
          className={`relative flex items-center gap-3 p-3 rounded-xl border-2 transition-colors ${
            doc.status === 'done'
              ? 'border-green-500 bg-green-50'
              : doc.status === 'error'
              ? 'border-red-300 bg-red-50'
              : 'border-dashed border-gray-300 bg-gray-50 hover:border-gray-400'
          }`}
        >
          {doc.status === 'idle' && (
            <>
              <Upload className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <div>
                <p className="text-sm text-gray-600 font-medium">Click to upload</p>
                <p className="text-xs text-gray-400">JPG, PNG, PDF — max 5MB</p>
              </div>
              <label htmlFor={inputId} className="absolute inset-0 cursor-pointer">
                <input
                  id={inputId}
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  className="hidden"
                  onChange={(e) => handleDocFile(e, type, setter)}
                />
              </label>
            </>
          )}

          {doc.status === 'uploading' && (
            <>
              <Loader2 className="w-5 h-5 text-primary-600 animate-spin flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-gray-700 font-medium">{doc.file?.name}</p>
                <div className="w-full h-1.5 bg-gray-200 rounded-full mt-1 overflow-hidden">
                  <div
                    className="h-full bg-primary-600 rounded-full transition-all"
                    style={{ width: `${doc.progress}%` }}
                  />
                </div>
              </div>
              <span className="text-xs text-gray-500">{doc.progress}%</span>
            </>
          )}

          {doc.status === 'done' && (
            <>
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
              <p className="text-sm text-green-700 font-medium flex-1 truncate">{doc.file?.name ?? 'Uploaded'}</p>
              <button
                type="button"
                onClick={() => setter({ ...INITIAL_DOC })}
                className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          )}

          {doc.status === 'error' && (
            <>
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-600 flex-1">Upload failed</p>
              <button
                type="button"
                onClick={() => {
                  if (doc.file) uploadDocument(doc.file, type, setter);
                }}
                className="text-xs font-medium text-red-600 hover:text-red-700 flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Retry
              </button>
            </>
          )}
        </div>
        {errors[errorKey] && <p className="text-xs text-red-500 mt-1">{errors[errorKey]}</p>}
      </div>
    );
  }

  // ── Completed screen ──────────────────────────────────────────────────────────
  if (completed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Registration Submitted!</h1>
            <p className="text-gray-600 leading-relaxed">
              We&apos;ll verify your account within 24 hours. You&apos;ll receive a WhatsApp notification once your account is approved.
            </p>
          </div>
          <div className="card p-4 text-left space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">What happens next</p>
            {[
              'Our team reviews your documents (within 24h)',
              'You receive a WhatsApp notification on +91 ' + phone,
              'Start listing your inventory and grow your business',
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <p className="text-sm text-gray-700">{step}</p>
              </div>
            ))}
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 py-3 px-6 rounded-xl text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // ── Main form ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-gray-100 flex flex-col">
      {/* Top bar */}
      <div className="p-4">
        <Link href="/" className="inline-flex items-center gap-2 text-primary-600 font-semibold text-sm hover:text-primary-700">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-6">
        <div className="w-full max-w-lg space-y-5">
          {/* Logo */}
          <div className="text-center">
            <div className="w-14 h-14 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
              <ShoppingBag className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              Nirmal<span className="text-primary-600">Mandi</span>
            </h1>
            <p className="text-sm text-gray-500 mt-1">Become a Seller</p>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {STEPS.map((label, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <div key={label} className="flex items-center gap-1.5 flex-shrink-0">
                  <div className={`flex items-center gap-1.5 text-xs font-medium ${active ? 'text-primary-700' : done ? 'text-green-700' : 'text-gray-400'}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                      done ? 'bg-green-500 border-green-500 text-white' : active ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-gray-200 text-gray-400'
                    }`}>
                      {done ? <Check className="w-3 h-3" /> : i + 1}
                    </div>
                    <span className="hidden lg:inline text-xs max-w-[72px] truncate">{label}</span>
                  </div>
                  {i < STEPS.length - 1 && <div className={`h-0.5 w-4 rounded ${i < step ? 'bg-green-400' : 'bg-gray-200'}`} />}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-500 sm:hidden">Step {step + 1}: {STEPS[step]}</p>

          {/* Step card */}
          <div className="card p-6">
            {/* ── Step 1: Phone & OTP ─────────────────────────────────────── */}
            {step === 0 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Phone Verification</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Enter your mobile number to get started</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">+91</span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); clearError('phone'); }}
                      placeholder="9876543210"
                      className="input-field pl-10"
                      inputMode="numeric"
                      disabled={otpSent}
                    />
                    <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                  <FieldError msg={errors.phone} />
                </div>

                {!otpSent ? (
                  <button
                    onClick={handleSendOtp}
                    disabled={loading}
                    className="btn-primary w-full flex items-center justify-center gap-2 py-2.5"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {loading ? 'Sending OTP…' : 'Send OTP'}
                  </button>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        6-digit OTP sent to +91 {phone}
                        <button
                          type="button"
                          onClick={() => { setOtpSent(false); setOtp(''); }}
                          className="ml-2 text-xs text-primary-600 hover:underline"
                        >
                          Change
                        </button>
                      </label>
                      <div className="relative">
                        <input
                          type="tel"
                          value={otp}
                          onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); clearError('otp'); }}
                          placeholder="123456"
                          className="input-field text-center text-2xl tracking-widest font-bold"
                          inputMode="numeric"
                          autoFocus
                        />
                        <KeyRound className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      </div>
                      <FieldError msg={errors.otp} />
                    </div>

                    <button
                      onClick={handleVerifyOtp}
                      disabled={loading || otp.length !== 6}
                      className="btn-primary w-full flex items-center justify-center gap-2 py-2.5 disabled:opacity-60"
                    >
                      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                      {loading ? 'Verifying…' : 'Verify OTP'}
                    </button>

                    <div className="text-center">
                      {resendTimer > 0 ? (
                        <p className="text-sm text-gray-500">Resend OTP in {resendTimer}s</p>
                      ) : (
                        <button
                          type="button"
                          onClick={handleSendOtp}
                          className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                        >
                          Resend OTP
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── Step 2: Business Details ──────────────────────────────────── */}
            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Business Details</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Tell us about your business</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Business Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={businessName}
                      onChange={(e) => { setBusinessName(e.target.value); clearError('businessName'); }}
                      placeholder="ABC Traders Pvt. Ltd."
                      className="input-field"
                    />
                    <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                  <FieldError msg={errors.businessName} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Business Type <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {BUSINESS_TYPES.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => { setBusinessType(t.value); clearError('businessType'); }}
                        className={`py-2.5 px-3 rounded-xl text-sm font-medium border-2 transition-all text-left ${
                          businessType === t.value
                            ? 'border-primary-600 bg-primary-50 text-primary-700'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <FieldError msg={errors.businessType} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    GST Number <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={gstNumber}
                      onChange={(e) => { setGstNumber(e.target.value.toUpperCase().slice(0, 15)); clearError('gstNumber'); }}
                      placeholder="27AAPFU0939F1ZV"
                      className="input-field font-mono"
                      maxLength={15}
                    />
                    <FileText className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                  {gstNumber && GST_REGEX.test(gstNumber) && (
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Valid GST format
                    </p>
                  )}
                  <FieldError msg={errors.gstNumber} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      PAN Number <span className="text-gray-400 text-xs font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={panNumber}
                      onChange={(e) => setPanNumber(e.target.value.toUpperCase().slice(0, 10))}
                      placeholder="ABCDE1234F"
                      className="input-field font-mono"
                      maxLength={10}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      MSME Number <span className="text-gray-400 text-xs font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={msmeNumber}
                      onChange={(e) => setMsmeNumber(e.target.value)}
                      placeholder="UDYAM-XX-00-0000000"
                      className="input-field"
                    />
                    <p className="text-xs text-gray-400 mt-0.5">Shown as badge on listings</p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 3: Address ────────────────────────────────────────────── */}
            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Business Address</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Your registered business address</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address Line 1 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={bizLine1}
                    onChange={(e) => { setBizLine1(e.target.value); clearError('bizLine1'); }}
                    placeholder="Building / Street"
                    className="input-field"
                  />
                  <FieldError msg={errors.bizLine1} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address Line 2 <span className="text-gray-400 text-xs font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={bizLine2}
                    onChange={(e) => setBizLine2(e.target.value)}
                    placeholder="Area / Landmark"
                    className="input-field"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      City <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={bizCity}
                      onChange={(e) => { setBizCity(e.target.value); clearError('bizCity'); }}
                      placeholder="Mumbai"
                      className="input-field"
                    />
                    <FieldError msg={errors.bizCity} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Pincode <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={bizPincode}
                      onChange={(e) => { setBizPincode(e.target.value.replace(/\D/g, '').slice(0, 6)); clearError('bizPincode'); }}
                      placeholder="400001"
                      className="input-field"
                      inputMode="numeric"
                    />
                    <FieldError msg={errors.bizPincode} />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    State <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={bizState}
                      onChange={(e) => { setBizState(e.target.value); clearError('bizState'); }}
                      className="input-field appearance-none pr-8"
                    >
                      <option value="">Select state</option>
                      {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                  <FieldError msg={errors.bizState} />
                </div>

                {/* Warehouse toggle */}
                <div className="pt-3 border-t border-gray-100">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={warehouseSame}
                      onChange={(e) => setWarehouseSame(e.target.checked)}
                      className="rounded border-gray-300 text-primary-600 w-4 h-4"
                    />
                    <span className="text-sm font-medium text-gray-700">Warehouse same as business address</span>
                  </label>
                </div>

                {!warehouseSame && (
                  <div className="space-y-4 pl-4 border-l-2 border-gray-200">
                    <p className="text-sm font-semibold text-gray-700">Warehouse Address</p>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1 <span className="text-red-500">*</span></label>
                      <input type="text" value={whLine1} onChange={(e) => { setWhLine1(e.target.value); clearError('whLine1'); }} placeholder="Building / Street" className="input-field" />
                      <FieldError msg={errors.whLine1} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2 <span className="text-gray-400 text-xs font-normal">(optional)</span></label>
                      <input type="text" value={whLine2} onChange={(e) => setWhLine2(e.target.value)} placeholder="Area / Landmark" className="input-field" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">City <span className="text-red-500">*</span></label>
                        <input type="text" value={whCity} onChange={(e) => { setWhCity(e.target.value); clearError('whCity'); }} placeholder="City" className="input-field" />
                        <FieldError msg={errors.whCity} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Pincode <span className="text-red-500">*</span></label>
                        <input type="text" value={whPincode} onChange={(e) => { setWhPincode(e.target.value.replace(/\D/g, '').slice(0, 6)); clearError('whPincode'); }} placeholder="400001" className="input-field" inputMode="numeric" />
                        <FieldError msg={errors.whPincode} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">State <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <select value={whState} onChange={(e) => { setWhState(e.target.value); clearError('whState'); }} className="input-field appearance-none pr-8">
                          <option value="">Select state</option>
                          {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      </div>
                      <FieldError msg={errors.whState} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Step 4: Bank Account ──────────────────────────────────────── */}
            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Bank Account</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Your payouts will be credited to this account</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Account Holder Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={accountHolder}
                    onChange={(e) => { setAccountHolder(e.target.value); clearError('accountHolder'); }}
                    placeholder="As per bank records"
                    className="input-field"
                  />
                  <FieldError msg={errors.accountHolder} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Account Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => { setAccountNumber(e.target.value.replace(/\D/g, '')); clearError('accountNumber'); setBankVerified(false); }}
                    placeholder="Enter account number"
                    className="input-field font-mono"
                    inputMode="numeric"
                  />
                  <FieldError msg={errors.accountNumber} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    IFSC Code <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={ifsc}
                        onChange={(e) => { setIfsc(e.target.value.toUpperCase().slice(0, 11)); clearError('ifsc'); setBankVerified(false); }}
                        placeholder="SBIN0001234"
                        className="input-field font-mono"
                        maxLength={11}
                      />
                      {ifsc && IFSC_REGEX.test(ifsc) && !bankVerified && (
                        <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Valid format
                        </p>
                      )}
                      <FieldError msg={errors.ifsc} />
                    </div>
                    <button
                      type="button"
                      onClick={handleVerifyBank}
                      disabled={bankVerifying || bankVerified}
                      className={`py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 flex-shrink-0 ${
                        bankVerified
                          ? 'bg-green-100 text-green-700'
                          : 'bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-50'
                      }`}
                    >
                      {bankVerifying ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : bankVerified ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <CreditCard className="w-4 h-4" />
                      )}
                      {bankVerified ? 'Verified' : 'Verify'}
                    </button>
                  </div>
                </div>

                {bankVerified && (
                  <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-xl px-4 py-3">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    Account Verified ✓ — Payouts will be sent to this account
                  </div>
                )}

                <FieldError msg={errors.bankVerify} />
              </div>
            )}

            {/* ── Step 5: Documents & Agreement ────────────────────────────── */}
            {step === 4 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Documents & Agreement</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Upload your KYC documents to complete registration</p>
                </div>

                {renderDocUpload('GST Certificate *', gstCert, 'gst_certificate', setGstCert, 'gst-cert-input', 'gstCert')}
                {renderDocUpload('PAN Card *', panCard, 'pan_card', setPanCard, 'pan-card-input', 'panCard')}
                {renderDocUpload('Business Address Proof *', addressProof, 'address_proof', setAddressProof, 'address-proof-input', 'addressProof')}

                {/* Agreement checkbox */}
                <div className={`p-4 rounded-xl border-2 transition-colors ${agreed ? 'border-primary-300 bg-primary-50' : 'border-gray-200 bg-gray-50'}`}>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreed}
                      onChange={(e) => { setAgreed(e.target.checked); clearError('agreed'); }}
                      className="rounded border-gray-300 text-primary-600 w-4 h-4 mt-0.5 flex-shrink-0"
                    />
                    <span className="text-sm text-gray-700">
                      I agree to NirmalMandi&apos;s{' '}
                      <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline font-medium">
                        Seller Agreement
                      </a>
                      {' '}and understand that my account is subject to verification before activation.
                    </span>
                  </label>
                </div>
                <FieldError msg={errors.agreed} />

                <button
                  onClick={handleComplete}
                  disabled={loading}
                  className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base font-bold disabled:opacity-60"
                >
                  {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                  {loading ? 'Submitting…' : 'Complete Registration'}
                </button>
              </div>
            )}
          </div>

          {/* Navigation (steps 1-3) */}
          {step > 0 && step < 4 && (
            <div className="flex items-center justify-between">
              <button
                onClick={() => { setStep((s) => Math.max(s - 1, 0)); setErrors({}); }}
                className="flex items-center gap-2 py-2.5 px-5 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={handleNext}
                className="flex items-center gap-2 py-2.5 px-5 rounded-lg text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white transition-colors"
              >
                Next Step
                <Check className="w-4 h-4" />
              </button>
            </div>
          )}

          {step === 4 && (
            <button
              onClick={() => { setStep(3); setErrors({}); }}
              className="flex items-center gap-2 py-2.5 px-5 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          )}

          <p className="text-center text-xs text-gray-400">
            Already have a seller account?{' '}
            <Link href="/login" className="text-primary-600 hover:underline font-medium">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
