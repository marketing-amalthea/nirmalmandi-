'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  X, ExternalLink, CheckCircle, XCircle, Clock, Loader2, FileText,
  Image as ImageIcon, File as FileIcon, RefreshCw,
} from 'lucide-react';
import api from '@/lib/api';
import AdminShell from '@/components/ui/AdminShell';
import Kpi from '@/components/ui/Kpi';
import Badge from '@/components/ui/Badge';
import Avatar, { initialsOf } from '@/components/ui/Avatar';
import { Users, ShieldCheck, FileCheck, FileX } from 'lucide-react';

interface KycDocument { id: string; filename: string; documentType: string; url: string; }
interface KycSubmission {
  id: string; sellerId: string; sellerName: string; businessName: string;
  businessType: string; gstNumber: string; panNumber: string; msmeNumber: string | null;
  documents: KycDocument[]; submittedAt: string;
  status: 'pending' | 'in_review' | 'approved' | 'rejected'; kycTier?: string;
  phone?: string;
}
interface KycListResponse { rows: KycSubmission[]; total: number; page: number; limit: number; }
interface KycStatsData { pending: number; approvedToday: number; rejectedToday: number; avgReviewTimeHours: number; }

const kycApi = {
  getList: (params: Record<string, string | number>) => api.get('/admin/kyc', { params }),
  reviewKyc: (id: string, body: Record<string, string>) => api.post(`/admin/kyc/${id}/review`, body),
  getStats: () => api.get('/admin/kyc/stats'),
};

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Verified' },
  { value: 'rejected', label: 'Rejected' },
];

function DocIcon({ type }: { type: string }) {
  const t = type.toLowerCase();
  if (t.includes('image') || t.includes('photo') || t.includes('jpg') || t.includes('png'))
    return <ImageIcon size={14} style={{ color: 'var(--nm-info)' }} className="flex-shrink-0" />;
  if (t.includes('pdf')) return <FileText size={14} style={{ color: 'var(--nm-red)' }} className="flex-shrink-0" />;
  return <FileIcon size={14} style={{ color: 'var(--nm-faint)' }} className="flex-shrink-0" />;
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span style={{ fontSize: 12, color: 'var(--nm-muted)' }} className="flex-shrink-0">{label}</span>
      <span className={mono ? 'num' : ''} style={{ fontSize: 12.5, color: 'var(--nm-ink)', fontWeight: 600, textAlign: 'right' }}>
        {value || '—'}
      </span>
    </div>
  );
}

interface ReviewPanelProps {
  submission: KycSubmission | null;
  onClose: () => void;
  onActionSuccess: () => void;
}

function ReviewPanel({ submission, onClose, onActionSuccess }: ReviewPanelProps) {
  const [activeAction, setActiveAction] = useState<'reject' | 'request_more' | null>(null);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<KycDocument | null>(null);

  useEffect(() => { setActiveAction(null); setReason(''); setMessage(''); }, [submission?.id]);
  if (!submission) return null;

  async function submitAction(action: string, extra?: Record<string, string>) {
    if (!submission) return;
    setLoading(action);
    try {
      // Backend expects { status, note } not { action }
      const statusMap: Record<string, string> = { approve: 'approved', reject: 'rejected', request_more: 'in_review' };
      const status = statusMap[action] ?? action;
      const note = extra?.reason ?? extra?.message ?? extra?.tier ?? undefined;
      await kycApi.reviewKyc(submission.id, { status, ...(note ? { note } : {}) });
      toast.success(
        action === 'approve' ? `KYC approved`
          : action === 'reject' ? 'KYC rejected' : 'Additional documents requested'
      );
      onActionSuccess(); onClose();
    } catch { toast.error('Action failed — please try again'); }
    finally { setLoading(null); }
  }

  return (
    <>
      {previewDoc && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="nm-card flex flex-col overflow-hidden" style={{ width: '100%', maxWidth: 760, maxHeight: '90vh' }}>
            <div className="flex items-center justify-between" style={{ padding: '12px 20px', borderBottom: '1px solid var(--nm-line)' }}>
              <div>
                <p className="disp" style={{ fontSize: 14, fontWeight: 700, color: 'var(--nm-ink)' }}>{previewDoc.filename}</p>
                <p style={{ fontSize: 12, color: 'var(--nm-muted)', textTransform: 'capitalize' }}>{previewDoc.documentType.replace(/_/g, ' ')}</p>
              </div>
              <div className="flex items-center gap-3">
                <a href={previewDoc.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1" style={{ fontSize: 12.5, color: 'var(--nm-green)', fontWeight: 600 }}>
                  <ExternalLink size={12} /> Open
                </a>
                <button onClick={() => setPreviewDoc(null)} style={{ color: 'var(--nm-muted)' }}><X size={16} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden" style={{ background: 'var(--nm-panel)' }}>
              {previewDoc.documentType.toLowerCase().includes('pdf') || previewDoc.url.endsWith('.pdf') ? (
                <iframe src={previewDoc.url} className="w-full" style={{ height: '100%', minHeight: 500 }} title={previewDoc.filename} />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewDoc.url} alt={previewDoc.filename} className="w-full object-contain" style={{ maxHeight: '70vh', padding: 16 }} />
              )}
            </div>
          </div>
        </div>
      )}

      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 flex flex-col overflow-hidden" style={{ width: 480, background: 'var(--nm-card)', boxShadow: 'var(--nm-line) -1px 0 0' }}>
        <div className="flex items-center justify-between flex-shrink-0" style={{ padding: '16px 24px', borderBottom: '1px solid var(--nm-line)' }}>
          <div>
            <h2 className="disp" style={{ fontSize: 16, fontWeight: 700, color: 'var(--nm-ink)' }}>KYC review</h2>
            <p style={{ fontSize: 12, color: 'var(--nm-muted)', marginTop: 2 }}>
              Submitted {new Date(submission.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--nm-muted)' }}><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin" style={{ padding: '20px 24px' }}>
          <p className="label" style={{ marginBottom: 12 }}>Seller details</p>
          <div className="nm-card" style={{ padding: 16, marginBottom: 24 }}>
            <div className="flex flex-col gap-2.5">
              <DetailRow label="Seller name" value={submission.sellerName} />
              <DetailRow label="Business name" value={submission.businessName} />
              <DetailRow label="Business type" value={submission.businessType} />
              <DetailRow label="GST number" value={submission.gstNumber} mono />
              <DetailRow label="PAN number" value={submission.panNumber} mono />
              {submission.msmeNumber && <DetailRow label="MSME number" value={submission.msmeNumber} mono />}
              <div className="flex items-center gap-2 pt-1">
                <span style={{ fontSize: 12, color: 'var(--nm-muted)' }}>Status:</span>
                <Badge status={submission.status} />
              </div>
            </div>
          </div>

          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(() => { const docs = (submission.documents ?? []) as any[]; return (<>
          <p className="label" style={{ marginBottom: 12 }}>Documents ({docs.length})</p>
          {docs.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--nm-muted)' }}>No documents uploaded.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {docs.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between" style={{ padding: 12, border: '1px solid var(--nm-line)', borderRadius: 12 }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <DocIcon type={doc.documentType ?? ''} />
                    <div className="min-w-0">
                      <p className="truncate" style={{ fontSize: 13, color: 'var(--nm-ink)', fontWeight: 600 }}>{doc.filename}</p>
                      <p style={{ fontSize: 11.5, color: 'var(--nm-muted)', textTransform: 'capitalize' }}>{(doc.documentType ?? '').replace(/_/g, ' ')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <button onClick={() => setPreviewDoc(doc)} style={{ fontSize: 12.5, color: 'var(--nm-green)', fontWeight: 600 }}>Preview</button>
                    <a href={doc.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--nm-faint)' }}><ExternalLink size={11} /></a>
                  </div>
                </div>
              ))}
            </div>
          )}
          </>); })()}

          {activeAction === 'reject' && (
            <div style={{ marginTop: 24, padding: 16, border: '1px solid var(--nm-red-soft)', borderRadius: 12, background: 'var(--nm-red-soft)' }}>
              <p className="disp" style={{ fontSize: 13, fontWeight: 700, color: 'var(--nm-red)', marginBottom: 8 }}>Rejection reason</p>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
                placeholder="Explain why the KYC is being rejected..." className="nm-input" style={{ resize: 'none' }} />
              <div className="flex gap-2 mt-3">
                <button onClick={() => { if (!reason.trim()) { toast.error('Please provide a rejection reason'); return; } submitAction('reject', { reason }); }}
                  disabled={!!loading} className="nm-btn-danger" style={{ padding: '9px 16px', fontSize: 13 }}>
                  {loading === 'reject' && <Loader2 size={13} className="animate-spin" />} Confirm rejection
                </button>
                <button onClick={() => setActiveAction(null)} className="nm-btn-secondary" style={{ padding: '9px 16px', fontSize: 13 }}>Cancel</button>
              </div>
            </div>
          )}

          {activeAction === 'request_more' && (
            <div style={{ marginTop: 24, padding: 16, border: '1px solid var(--nm-info-soft)', borderRadius: 12, background: 'var(--nm-info-soft)' }}>
              <p className="disp" style={{ fontSize: 13, fontWeight: 700, color: 'var(--nm-info)', marginBottom: 8 }}>Message to seller</p>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3}
                placeholder="Describe what additional documents are needed..." className="nm-input" style={{ resize: 'none' }} />
              <div className="flex gap-2 mt-3">
                <button onClick={() => { if (!message.trim()) { toast.error('Please enter a message'); return; } submitAction('request_more', { message }); }}
                  disabled={!!loading} className="nm-btn-primary" style={{ padding: '9px 16px', fontSize: 13 }}>
                  {loading === 'request_more' && <Loader2 size={13} className="animate-spin" />} Send request
                </button>
                <button onClick={() => setActiveAction(null)} className="nm-btn-secondary" style={{ padding: '9px 16px', fontSize: 13 }}>Cancel</button>
              </div>
            </div>
          )}
        </div>

        {!activeAction && (
          <div className="flex-shrink-0" style={{ padding: '16px 24px', borderTop: '1px solid var(--nm-line)', background: 'var(--nm-panel)' }}>
            <p className="label" style={{ marginBottom: 10 }}>Take action</p>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button onClick={() => submitAction('approve', { tier: 'basic' })} disabled={!!loading}
                className="nm-btn-primary" style={{ padding: '10px', fontSize: 13 }}>
                <CheckCircle size={14} /> Approve · Basic
              </button>
              <button onClick={() => submitAction('approve', { tier: 'verified' })} disabled={!!loading}
                className="nm-btn-soft" style={{ padding: '10px', fontSize: 13 }}>
                <CheckCircle size={14} /> Approve · Verified
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setActiveAction('reject')} disabled={!!loading}
                className="nm-btn-ghost-red" style={{ padding: '10px', justifyContent: 'center' }}>
                <XCircle size={14} /> Reject
              </button>
              <button onClick={() => setActiveAction('request_more')} disabled={!!loading}
                className="nm-btn-secondary" style={{ padding: '10px', fontSize: 13 }}>
                <Clock size={14} /> Request docs
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

const PAGE_SIZE = 20;

export default function KycPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedSubmission, setSelectedSubmission] = useState<KycSubmission | null>(null);

  const queryParams: Record<string, string | number> = { page, limit: PAGE_SIZE };
  if (statusFilter) queryParams.status = statusFilter;

  const { data, isLoading, refetch } = useQuery<KycListResponse>({
    queryKey: ['kyc-list', page, statusFilter],
    queryFn: async () => (await kycApi.getList(queryParams)).data?.data ?? { rows: [], total: 0 },
    retry: 1,
  });

  const { data: statsData, isLoading: statsLoading } = useQuery<KycStatsData>({
    queryKey: ['kyc-stats'],
    queryFn: async () => (await kycApi.getStats()).data?.data ?? { pending: 0, approvedToday: 0, rejectedToday: 0, avgReviewTimeHours: 0 },
    retry: 1,
  });

  const submissions = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  function handleActionSuccess() {
    queryClient.invalidateQueries({ queryKey: ['kyc-list'] });
    queryClient.invalidateQueries({ queryKey: ['kyc-stats'] });
  }

  const totalCount = (statsData?.pending ?? 0) + (statsData?.approvedToday ?? 0) + (statsData?.rejectedToday ?? 0);

  return (
    <AdminShell
      title="KYC"
      subtitle="Seller identity verification"
      actions={
        <button onClick={() => refetch()} className="nm-btn-secondary" style={{ padding: '9px 14px', fontSize: 13 }}>
          <RefreshCw size={14} /> Refresh
        </button>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Total" value={totalCount.toLocaleString('en-IN')} loading={statsLoading} icon={Users} />
        <Kpi label="Pending" value={(statsData?.pending ?? 0).toLocaleString('en-IN')} loading={statsLoading} icon={Clock} />
        <Kpi label="Verified today" value={(statsData?.approvedToday ?? 0).toLocaleString('en-IN')} loading={statsLoading} icon={FileCheck} />
        <Kpi label="Rejected today" value={(statsData?.rejectedToday ?? 0).toLocaleString('en-IN')} loading={statsLoading} icon={FileX} danger />
      </div>

      <div className="nm-tabbar mt-5">
        {STATUS_TABS.map((tab) => (
          <button key={tab.value} onClick={() => { setStatusFilter(tab.value); setPage(1); }}
            className={`nm-tab ${statusFilter === tab.value ? 'active' : ''}`}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="nm-card overflow-hidden mt-4">
        <div className="overflow-x-auto scrollbar-thin" style={{ padding: '18px 22px' }}>
          <table className="nm-table">
            <thead>
              <tr>
                <th>Seller</th><th>Phone</th><th>Documents</th><th>Submitted</th><th>Status</th><th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={6}><div className="animate-pulse" style={{ height: 18, background: 'var(--nm-line-soft)', borderRadius: 6 }} /></td></tr>
                ))
              ) : submissions.length === 0 ? (
                <tr><td colSpan={6}>
                  <div className="text-center" style={{ padding: '48px 0', color: 'var(--nm-muted)' }}>
                    <ShieldCheck size={34} className="mx-auto" style={{ color: 'var(--nm-faint)', marginBottom: 10 }} />
                    <p style={{ fontSize: 13 }}>No KYC submissions found</p>
                  </div>
                </td></tr>
              ) : (
                submissions.map((s) => {
                  const reviewed = s.status === 'approved' || s.status === 'rejected';
                  return (
                    <tr key={s.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <Avatar initials={initialsOf(s.sellerName)} size={32} />
                          <div>
                            <div className="disp" style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--nm-ink)' }}>{s.sellerName}</div>
                            <div style={{ fontSize: 12, color: 'var(--nm-muted)' }}>{s.businessName}</div>
                          </div>
                        </div>
                      </td>
                      <td className="num" style={{ color: 'var(--nm-muted)' }}>{s.phone ?? '—'}</td>
                      <td>
                        <button onClick={() => setSelectedSubmission(s)} className="flex items-center gap-1" style={{ fontSize: 13, color: 'var(--nm-green)', fontWeight: 600 }}>
                          GSTIN + PAN <ExternalLink size={12} />
                        </button>
                      </td>
                      <td style={{ color: 'var(--nm-muted)', fontSize: 12.5 }}>
                        {new Date(s.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td><Badge status={s.status} /></td>
                      <td style={{ textAlign: 'right' }}>
                        {reviewed ? (
                          <button onClick={() => setSelectedSubmission(s)} className="nm-btn-secondary" style={{ padding: '7px 14px', fontSize: 12.5 }}>Reviewed</button>
                        ) : (
                          <div className="flex items-center gap-2 justify-end">
                            <button onClick={() => setSelectedSubmission(s)} className="nm-btn-primary" style={{ padding: '7px 14px', fontSize: 12.5 }}>Approve</button>
                            <button onClick={() => setSelectedSubmission(s)} className="nm-btn-ghost-red">Reject</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between" style={{ padding: '14px 22px', borderTop: '1px solid var(--nm-line)' }}>
            <p style={{ fontSize: 12.5, color: 'var(--nm-muted)' }}>
              {Math.min((page - 1) * PAGE_SIZE + 1, total)}–{Math.min(page * PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="nm-btn-secondary" style={{ padding: '7px 14px', fontSize: 12.5 }}>Previous</button>
              <span style={{ fontSize: 12.5, color: 'var(--nm-muted)' }}>Page {page} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="nm-btn-secondary" style={{ padding: '7px 14px', fontSize: 12.5 }}>Next</button>
            </div>
          </div>
        )}
      </div>

      <ReviewPanel submission={selectedSubmission} onClose={() => setSelectedSubmission(null)} onActionSuccess={handleActionSuccess} />
    </AdminShell>
  );
}
