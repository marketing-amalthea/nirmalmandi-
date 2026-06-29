'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import AdminShell from '@/components/ui/AdminShell';
import Toggle from '@/components/ui/Toggle';
import { categoriesApi } from '@/lib/api';

interface Category {
  id: string; name: string; slug: string; status: string;
  // Backend (adminCategories.ts) returns camelCase aliases; keep snake_case optional for safety.
  commissionRate?: number; commission_rate?: number;
  gstRate?: number; gst_rate?: number;
  listingCount?: number; listing_count?: number;
  adminApproved?: boolean; admin_approved?: boolean;
}
interface FormData { name: string; slug: string; commission_rate: string; gst_rate: string; }
const EMPTY: FormData = { name: '', slug: '', commission_rate: '3', gst_rate: '18' };

function slugify(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

export default function CategoriesPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const res = await categoriesApi.getCategories();
      const d = (res.data as { data?: { rows?: Category[] } | Category[] })?.data;
      if (Array.isArray(d)) return d;
      return (d as { rows?: Category[] })?.rows ?? [];
    },
  });
  const categories: Category[] = data ?? [];

  const createMut = useMutation({
    mutationFn: () => categoriesApi.createCategory({ name: form.name, slug: form.slug, commission_rate: Number(form.commission_rate) / 100, gst_rate: Number(form.gst_rate) / 100 }),
    onSuccess: () => { toast.success('Category created'); qc.invalidateQueries({ queryKey: ['admin-categories'] }); setShowModal(false); setForm(EMPTY); },
    onError: () => toast.error('Failed to create category'),
  });

  const updateMut = useMutation({
    mutationFn: (id: string) => categoriesApi.updateCategory(id, { name: form.name, slug: form.slug, commission_rate: Number(form.commission_rate) / 100, gst_rate: Number(form.gst_rate) / 100 }),
    onSuccess: () => { toast.success('Category updated'); qc.invalidateQueries({ queryKey: ['admin-categories'] }); setShowModal(false); setEditing(null); },
    onError: () => toast.error('Failed to update category'),
  });

  const toggleMut = useMutation({
    mutationFn: (id: string) => categoriesApi.toggleCategory(id),
    onSuccess: () => { toast.success('Status updated'); qc.invalidateQueries({ queryKey: ['admin-categories'] }); },
    onError: () => toast.error('Failed to toggle status'),
  });

  function openEdit(c: Category) {
    setEditing(c);
    setForm({ name: c.name, slug: c.slug, commission_rate: String((c.commissionRate ?? c.commission_rate ?? 0.03) * 100), gst_rate: String((c.gstRate ?? c.gst_rate ?? 0.18) * 100) });
    setShowModal(true);
  }

  function openCreate() { setEditing(null); setForm(EMPTY); setShowModal(true); }

  function submit() {
    if (editing) updateMut.mutate(editing.id);
    else createMut.mutate();
  }

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <AdminShell title="Categories" actions={
      <button onClick={openCreate} className="nm-btn-primary flex items-center gap-2" style={{ fontSize: 13.5 }}>
        <Plus size={15} /> Add category
      </button>
    }>
      <div className="nm-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin" style={{ color: 'var(--nm-green)' }} /></div>
        ) : (
          <table className="nm-table">
            <thead><tr>
              <th>Category</th><th>Slug</th><th style={{ textAlign: 'right' }}>Commission</th>
              <th style={{ textAlign: 'right' }}>GST</th><th style={{ textAlign: 'right' }}>Listings</th>
              <th>Status</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {categories.map(c => (
                <tr key={c.id}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <span className="flex items-center justify-center" style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--nm-green-soft)', color: 'var(--nm-green)', fontSize: 14 }}>
                        {c.name.charAt(0)}
                      </span>
                      <span className="disp" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--nm-ink)' }}>{c.name}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: 12.5, color: 'var(--nm-muted)', fontFamily: 'monospace' }}>/{c.slug}</td>
                  <td className="num" style={{ textAlign: 'right', fontSize: 13 }}>{((c.commissionRate ?? c.commission_rate ?? 0.03) * 100).toFixed(1)}%</td>
                  <td className="num" style={{ textAlign: 'right', fontSize: 13 }}>{((c.gstRate ?? c.gst_rate ?? 0.18) * 100).toFixed(0)}%</td>
                  <td className="num" style={{ textAlign: 'right', fontSize: 13 }}>{c.listingCount ?? c.listing_count ?? 0}</td>
                  <td>
                    <Toggle on={c.status === 'active'} onChange={() => toggleMut.mutate(c.id)} />
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(c)} className="nm-btn-secondary flex items-center gap-1" style={{ padding: '5px 10px', fontSize: 12 }}>
                        <Pencil size={11} /> Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(20,12,4,.45)' }}>
          <div className="nm-card" style={{ padding: 28, maxWidth: 440, width: '100%' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="disp" style={{ fontSize: 18, fontWeight: 800, color: 'var(--nm-ink)' }}>{editing ? 'Edit' : 'Add'} category</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--nm-muted)' }}><X size={18} /></button>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="nm-label">Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value, slug: f.slug || slugify(e.target.value) }))} className="nm-input" placeholder="e.g. Electronics" />
              </div>
              <div>
                <label className="nm-label">Slug</label>
                <input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: slugify(e.target.value) }))} className="nm-input" placeholder="e.g. electronics" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="nm-label">Commission %</label>
                  <input type="number" value={form.commission_rate} onChange={e => setForm(f => ({ ...f, commission_rate: e.target.value }))} className="nm-input" step="0.5" />
                </div>
                <div>
                  <label className="nm-label">GST %</label>
                  <input type="number" value={form.gst_rate} onChange={e => setForm(f => ({ ...f, gst_rate: e.target.value }))} className="nm-input" step="1" />
                </div>
              </div>
              <div className="flex gap-3 mt-2">
                <button onClick={() => setShowModal(false)} className="nm-btn-secondary flex-1">Cancel</button>
                <button onClick={submit} disabled={!form.name || isPending} className="nm-btn-primary flex-1">
                  {isPending && <Loader2 size={14} className="animate-spin" />} {editing ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
