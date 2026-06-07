'use client';

import { useState } from 'react';
import { X, ShieldCheck, Upload, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';

interface Props {
  tier: 2 | 3;
  orderAmount: number;
  onVerified: () => void;
  onClose: () => void;
}

export default function TierVerifyModal({ tier, orderAmount, onVerified, onClose }: Props) {
  const [panNumber, setPanNumber] = useState('');
  const [panFile, setPanFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const amountLabel = orderAmount >= 1_00_00_000
    ? `₹${(orderAmount / 1_00_00_000).toFixed(1)} Cr`
    : `₹${(orderAmount / 1_00_000).toFixed(1)} L`;

  async function handleSubmit() {
    if (tier === 2) {
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(panNumber.trim().toUpperCase())) {
        toast.error('Enter a valid PAN number (e.g. ABCDE1234F)');
        return;
      }
      if (!panFile) { toast.error('Please upload PAN card copy'); return; }
    } else {
      if (!videoFile) { toast.error('Please upload a short video for KYC'); return; }
    }

    setSubmitting(true);
    try {
      const form = new FormData();
      if (tier === 2) {
        form.append('tier', '2');
        form.append('pan_number', panNumber.trim().toUpperCase());
        if (panFile) form.append('pan_card', panFile);
      } else {
        form.append('tier', '3');
        if (videoFile) form.append('video_kyc', videoFile);
      }
      await api.post('/profile/tier-verify', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(`Tier ${tier} verification submitted — you can proceed with this order`);
      onVerified();
    } catch {
      toast.error('Verification submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <h2 className="font-bold text-gray-900">
              Tier {tier} Verification Required
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Info banner */}
          <div className="flex gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              Orders above {tier === 2 ? '₹1 Lakh' : '₹10 Lakh'} require Tier {tier} verification.
              Your order total is <strong>{amountLabel}</strong>.
              This is a one-time process.
            </p>
          </div>

          {tier === 2 ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  PAN Number *
                </label>
                <input
                  type="text"
                  value={panNumber}
                  onChange={(e) => setPanNumber(e.target.value.toUpperCase().slice(0, 10))}
                  placeholder="ABCDE1234F"
                  className="input-field font-mono tracking-widest"
                  maxLength={10}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  PAN Card Copy * (JPG/PNG/PDF)
                </label>
                <label className="flex items-center gap-3 p-3 border-2 border-dashed border-gray-300 hover:border-indigo-400 rounded-xl cursor-pointer transition-colors">
                  <Upload className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    {panFile ? panFile.name : 'Click to upload PAN card'}
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*,.pdf"
                    onChange={(e) => setPanFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            </>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Video KYC * — Record a short 30-second video holding your Aadhaar/PAN
              </label>
              <label className="flex items-center gap-3 p-3 border-2 border-dashed border-gray-300 hover:border-indigo-400 rounded-xl cursor-pointer transition-colors">
                <Upload className="w-5 h-5 text-gray-400" />
                <span className="text-sm text-gray-600">
                  {videoFile ? videoFile.name : 'Click to upload video (MP4, max 50MB)'}
                </span>
                <input
                  type="file"
                  className="hidden"
                  accept="video/*"
                  onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          )}
        </div>

        <div className="px-5 pb-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            Submit & Proceed
          </button>
        </div>
      </div>
    </div>
  );
}
