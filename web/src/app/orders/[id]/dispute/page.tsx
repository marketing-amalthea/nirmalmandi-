'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Loader2, AlertCircle, X, CheckCircle, Plus, Package,
  LayoutDashboard, ShoppingBag, Heart, Gift, User,
} from 'lucide-react';
import { toast } from 'sonner';
import { AppShell, Badge, inr } from '@/components/ui';
import { type NavItem } from '@/components/ui/Sidebar';
import { ordersApi, disputeApi, type OrderDetail } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';

const NAV: NavItem[] = [
  { label: 'Dashboard',   href: '/dashboard', icon: LayoutDashboard },
  { label: 'Browse lots', href: '/listings',  icon: ShoppingBag },
  { label: 'Orders',      href: '/orders',    icon: Package },
  { label: 'Watchlist',   href: '/watchlist', icon: Heart },
  { label: 'Referral',    href: '/referral',  icon: Gift },
  { label: 'Profile',     href: '/profile',   icon: User },
];

const sidebarFooter = (
  <div style={{ background: 'rgba(255,255,255,.07)', borderRadius: 12, padding: '12px 14px' }}>
    <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,.65)', margin: 0, lineHeight: 1.4 }}>🛡 Escrow protected — every order is held safe until you confirm delivery.</p>
  </div>
);

const REASONS = [
  { key: 'not_received',      label: 'Never delivered' },
  { key: 'wrong_item',        label: 'Item not as described / wrong item' },
  { key: 'damaged',           label: 'Damaged on arrival' },
  { key: 'quality_issue',     label: 'Wrong grade / quality issue' },
  { key: 'quantity_mismatch', label: 'Quantity mismatch' },
  { key: 'other',             label: 'Other' },
];

const MAX_FILES = 3;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

interface UploadedFile {
  file: File;
  key: string;
  uploading: boolean;
  done: boolean;
  error: boolean;
  preview?: string;
}

export default function DisputePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!isAuthenticated()) router.replace('/login'); }, [router]);

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => ordersApi.getOrder(id),
    select: (res) => {
      const payload = res.data as unknown as { data?: OrderDetail } | OrderDetail;
      return (payload as { data?: OrderDetail })?.data ?? payload as OrderDetail;
    },
    enabled: !!id && isAuthenticated(),
  });

  async function uploadEvidenceFile(file: File, disputeId: string) {
    setUploadedFiles((prev) => prev.map((f) => f.file === file ? { ...f, uploading: true, error: false } : f));
    try {
      const res = await disputeApi.uploadEvidence(disputeId, file.name, file.type);
      const payload = res.data as unknown as { data?: { uploadUrl: string; fileUrl: string } };
      const { uploadUrl, fileUrl } = payload?.data ?? { uploadUrl: '', fileUrl: '' };
      if (uploadUrl) {
        await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
      }
      setUploadedFiles((prev) => prev.map((f) => f.file === file ? { ...f, uploading: false, done: true, key: fileUrl } : f));
    } catch {
      setUploadedFiles((prev) => prev.map((f) => f.file === file ? { ...f, uploading: false, error: true } : f));
      toast.error(`Failed to upload ${file.name}`);
    }
  }

  function uploadFile(file: File) {
    const newFile: UploadedFile = {
      file, key: '', uploading: false, done: false, error: false,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    };
    setUploadedFiles((prev) => [...prev, newFile]);
  }

  function handleFiles(files: FileList | File[]) {
    const fileArr = Array.from(files);
    const remaining = MAX_FILES - uploadedFiles.length;
    if (remaining <= 0) { toast.error(`Maximum ${MAX_FILES} files allowed`); return; }
    for (const file of fileArr.slice(0, remaining)) {
      if (file.size > MAX_FILE_SIZE) { toast.error(`${file.name} exceeds 5MB limit`); continue; }
      if (!file.type.startsWith('image/') && file.type !== 'application/pdf') { toast.error(`${file.name} is not an image or PDF`); continue; }
      uploadFile(file);
    }
  }

  const removeFile = useCallback((idx: number) => {
    setUploadedFiles((prev) => {
      const file = prev[idx];
      if (file?.preview) URL.revokeObjectURL(file.preview);
      return prev.filter((_, i) => i !== idx);
    });
  }, []);

  async function handleSubmit() {
    if (!reason) { toast.error('Please select a reason'); return; }
    if (description.trim().length < 20) { toast.error('Please describe the issue (min 20 characters)'); return; }
    setSubmitting(true);
    try {
      // Step 1: raise dispute → get disputeId
      const res = await disputeApi.raiseDispute({ orderId: id, reason, description });
      const disputeId = (res.data as unknown as { data?: { disputeId: string } })?.data?.disputeId;

      // Step 2: upload evidence files now that we have a real disputeId
      if (disputeId && uploadedFiles.length > 0) {
        await Promise.allSettled(
          uploadedFiles.map((f) => uploadEvidenceFile(f.file, disputeId))
        );
      }

      toast.success('Dispute raised. Escrow frozen.');
      router.push(`/orders/${id}`);
    } catch {
      toast.error('Failed to raise dispute. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <AppShell navItems={NAV} brandSub="Buyer Portal" sidebarFooter={sidebarFooter} title="Raise Dispute">
        <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin" style={{ color: 'var(--nm-green)' }} /></div>
      </AppShell>
    );
  }

  const orderNumber = order?.order_number ?? id.slice(0, 8).toUpperCase();
  const img = order?.listing_image ?? order?.listing_images?.[0];

  return (
    <AppShell
      navItems={NAV} brandSub="Buyer Portal" sidebarFooter={sidebarFooter}
      title="Raise Dispute"
      actions={<Badge status="Disputed" />}
    >
      <div className="flex flex-col" style={{ gap: 20, maxWidth: 720 }}>
        {/* Order context */}
        <div className="nm-card flex items-center gap-4" style={{ padding: 16 }}>
          <div className="flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ width: 48, height: 48, borderRadius: 10, background: 'var(--nm-panel)' }}>
            {img ? <img src={img} alt="" className="w-full h-full object-cover" /> : <Package size={22} style={{ color: 'var(--nm-faint)' }} />}
          </div>
          <div className="min-w-0">
            <p className="disp" style={{ fontSize: 14, fontWeight: 700, color: 'var(--nm-ink)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{order?.listing_title ?? `Order NM-${orderNumber}`}</p>
            <p style={{ fontSize: 12.5, color: 'var(--nm-muted)', margin: '3px 0 0' }}>
              by {order?.seller_business_name ?? 'Seller'} · qty {order?.quantity ?? '—'} · {inr(order?.total_amount ?? 0)}
            </p>
          </div>
        </div>

        {/* Reason chips */}
        <div className="nm-card" style={{ padding: 20 }}>
          <h3 className="disp" style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--nm-ink)', margin: '0 0 14px' }}>What went wrong?</h3>
          <div className="flex flex-wrap gap-2">
            {REASONS.map((r) => {
              const sel = reason === r.key;
              return (
                <button key={r.key} onClick={() => setReason(r.key)} className="nm-pill" style={{
                  cursor: 'pointer', fontWeight: 600, padding: '8px 14px',
                  border: sel ? '1px solid var(--nm-green)' : '1px solid var(--nm-line)',
                  background: sel ? 'var(--nm-green-soft)' : 'transparent',
                  color: sel ? 'var(--nm-green)' : 'var(--nm-muted)',
                }}>
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Description */}
        <div className="nm-card" style={{ padding: 20 }}>
          <h3 className="disp" style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--nm-ink)', margin: '0 0 12px' }}>Describe the issue</h3>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
            rows={4}
            className="nm-input"
            style={{ resize: 'none' }}
            placeholder="e.g. The lot was listed as Grade A but 40 units arrived scratched and water-damaged. Photos attached."
          />
        </div>

        {/* Evidence */}
        <div className="nm-card" style={{ padding: 20 }}>
          <h3 className="disp" style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--nm-ink)', margin: '0 0 4px' }}>Upload evidence</h3>
          <p style={{ fontSize: 12.5, color: 'var(--nm-muted)', margin: '0 0 14px' }}>Photos or PDFs · max {MAX_FILES} files, 5MB each</p>
          <div className="flex gap-3">
            {Array.from({ length: MAX_FILES }).map((_, slot) => {
              const uf = uploadedFiles[slot];
              if (uf) {
                return (
                  <div key={slot} className="relative overflow-hidden" style={{ width: 80, height: 80, borderRadius: 10, background: 'var(--nm-panel)', border: '1px solid var(--nm-line)' }}>
                    {uf.preview ? <img src={uf.preview} alt="" className="w-full h-full object-cover" /> : (
                      <div className="w-full h-full flex items-center justify-center"><Package size={22} style={{ color: 'var(--nm-faint)' }} /></div>
                    )}
                    {uf.uploading && <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(255,255,255,.7)' }}><Loader2 size={18} className="animate-spin" style={{ color: 'var(--nm-green)' }} /></div>}
                    {uf.done && <span className="absolute" style={{ bottom: 4, left: 4 }}><CheckCircle size={16} style={{ color: 'var(--nm-green)' }} /></span>}
                    {uf.error && <span className="absolute" style={{ bottom: 4, left: 4 }}><AlertCircle size={16} style={{ color: 'var(--nm-red)' }} /></span>}
                    <button onClick={() => removeFile(slot)} className="absolute flex items-center justify-center" style={{ top: 4, right: 4, width: 20, height: 20, borderRadius: 999, background: 'rgba(0,0,0,.55)', border: 'none', cursor: 'pointer' }}>
                      <X size={12} color="#fff" />
                    </button>
                  </div>
                );
              }
              const isNextSlot = slot === uploadedFiles.length;
              return (
                <button key={slot} disabled={!isNextSlot} onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center" style={{
                  width: 80, height: 80, borderRadius: 10, background: 'var(--nm-panel)',
                  border: '1.5px dashed var(--nm-line)', cursor: isNextSlot ? 'pointer' : 'default', opacity: isNextSlot ? 1 : 0.5,
                }}>
                  <Plus size={22} style={{ color: 'var(--nm-faint)' }} />
                </button>
              );
            })}
          </div>
          <input ref={fileInputRef} type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={(e) => e.target.files && handleFiles(e.target.files)} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3">
          <Link href={`/orders/${id}`} className="nm-btn-secondary no-underline">Cancel</Link>
          <button onClick={handleSubmit} disabled={submitting} className="nm-btn-danger" style={{ opacity: submitting ? 0.6 : 1 }}>
            {submitting && <Loader2 size={16} className="animate-spin" />} Submit dispute
          </button>
        </div>
      </div>
    </AppShell>
  );
}
