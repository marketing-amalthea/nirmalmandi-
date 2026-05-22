'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { categoriesApi } from '@/lib/api';
import { Tag, Plus, Pencil, ToggleLeft, ToggleRight, X, RefreshCw, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

interface Category extends Record<string, unknown> {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'inactive';
  commissionRate: number;
  gstRate: number;
  adminApproved: boolean;
  isAiGenerated: boolean;
  listingCount: number;
  createdAt: string;
}

interface CategoryResponse {
  rows: Category[];
  total: number;
}

interface FormData {
  name: string;
  slug: string;
  commission_rate: string;
  gst_rate: string;
}

const EMPTY_FORM: FormData = { name: '', slug: '', commission_rate: '3', gst_rate: '18' };

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function Modal({
  title, onClose, children,
}: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-nm-border dark:border-nm-border-dark">
          <h2 className="text-lg font-bold text-nm-text dark:text-nm-text-dark">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-nm-text-muted dark:text-nm-text-dark-muted transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function CategoryForm({
  initial, onSubmit, loading, submitLabel,
}: {
  initial: FormData;
  onSubmit: (data: FormData) => void;
  loading: boolean;
  submitLabel: string;
}) {
  const [form, setForm] = useState<FormData>(initial);

  const handleNameChange = (name: string) => {
    setForm((prev) => ({
      ...prev,
      name,
      // Auto-fill slug only if slug hasn't been manually edited away from auto
      slug: prev.slug === slugify(prev.name) || prev.slug === '' ? slugify(name) : prev.slug,
    }));
  };

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}
      className="space-y-4"
    >
      <div>
        <label className="block text-xs font-semibold text-nm-text-muted dark:text-nm-text-dark-muted mb-1">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
          value={form.name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="e.g. Electronics"
          className="w-full border border-nm-border dark:border-nm-border-dark bg-white dark:bg-gray-700 rounded-lg px-3 py-2.5 text-sm text-nm-text dark:text-nm-text-dark focus:outline-none focus:ring-2 focus:ring-nm-primary"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-nm-text-muted dark:text-nm-text-dark-muted mb-1">
          Slug <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
          value={form.slug}
          onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
          placeholder="e.g. electronics"
          pattern="[a-z0-9-]+"
          className="w-full border border-nm-border dark:border-nm-border-dark bg-white dark:bg-gray-700 rounded-lg px-3 py-2.5 text-sm text-nm-text dark:text-nm-text-dark focus:outline-none focus:ring-2 focus:ring-nm-primary font-mono"
        />
        <p className="text-xs text-nm-text-muted dark:text-nm-text-dark-muted mt-1">Lowercase letters, numbers, and hyphens only</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-nm-text-muted dark:text-nm-text-dark-muted mb-1">
            Commission %
          </label>
          <div className="relative">
            <input
              type="number"
              min="0"
              max="50"
              step="0.1"
              value={form.commission_rate}
              onChange={(e) => setForm((prev) => ({ ...prev, commission_rate: e.target.value }))}
              className="w-full border border-nm-border dark:border-nm-border-dark bg-white dark:bg-gray-700 rounded-lg px-3 py-2.5 pr-8 text-sm text-nm-text dark:text-nm-text-dark focus:outline-none focus:ring-2 focus:ring-nm-primary"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-nm-text-muted dark:text-nm-text-dark-muted">%</span>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-nm-text-muted dark:text-nm-text-dark-muted mb-1">
            GST Rate %
          </label>
          <div className="relative">
            <input
              type="number"
              min="0"
              max="28"
              step="0.5"
              value={form.gst_rate}
              onChange={(e) => setForm((prev) => ({ ...prev, gst_rate: e.target.value }))}
              className="w-full border border-nm-border dark:border-nm-border-dark bg-white dark:bg-gray-700 rounded-lg px-3 py-2.5 pr-8 text-sm text-nm-text dark:text-nm-text-dark focus:outline-none focus:ring-2 focus:ring-nm-primary"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-nm-text-muted dark:text-nm-text-dark-muted">%</span>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="submit" disabled={loading} className="nm-btn-primary flex items-center gap-2">
          {loading && <Loader2 size={14} className="animate-spin" />}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

export default function CategoriesPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Category | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await categoriesApi.getCategories();
      return (res.data?.data ?? { rows: [], total: 0 }) as CategoryResponse;
    },
    retry: 1,
  });

  const categories = data?.rows ?? [];

  const createMutation = useMutation({
    mutationFn: (form: FormData) =>
      categoriesApi.createCategory({
        name: form.name,
        slug: form.slug,
        commission_rate: Number(form.commission_rate) / 100,
        gst_rate: Number(form.gst_rate) / 100,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      setShowCreate(false);
      showToast('success', 'Category created successfully');
    },
    onError: (err: any) => {
      showToast('error', err?.response?.data?.error || 'Failed to create category');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, form }: { id: string; form: FormData }) =>
      categoriesApi.updateCategory(id, {
        name: form.name,
        slug: form.slug,
        commission_rate: Number(form.commission_rate) / 100,
        gst_rate: Number(form.gst_rate) / 100,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      setEditTarget(null);
      showToast('success', 'Category updated');
    },
    onError: (err: any) => {
      showToast('error', err?.response?.data?.error || 'Failed to update category');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => categoriesApi.toggleCategory(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: () => showToast('error', 'Failed to toggle category status'),
  });

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-nm-text dark:text-nm-text-dark">Categories</h1>
          <p className="text-sm text-nm-text-muted dark:text-nm-text-dark-muted mt-0.5">
            Manage product sectors, commission rates, and GST configuration
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="nm-btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw size={14} />
            Refresh
          </button>
          <button onClick={() => setShowCreate(true)} className="nm-btn-primary flex items-center gap-2 text-sm">
            <Plus size={14} />
            Add Category
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`flex items-center justify-between gap-3 px-4 py-3 rounded-lg text-sm font-medium ${
          toast.type === 'success'
            ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300'
            : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300'
        }`}>
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
            {toast.text}
          </div>
          <button onClick={() => setToast(null)}><X size={14} /></button>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Categories', value: categories.length },
          { label: 'Active', value: categories.filter((c) => c.status === 'active').length },
          { label: 'Total Listings', value: categories.reduce((sum, c) => sum + (c.listingCount || 0), 0) },
        ].map((s) => (
          <div key={s.label} className="nm-card p-4 text-center">
            <p className="text-2xl font-bold text-nm-text dark:text-nm-text-dark">{s.value}</p>
            <p className="text-xs text-nm-text-muted dark:text-nm-text-dark-muted mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="nm-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-nm-border dark:border-nm-border-dark bg-gray-50 dark:bg-gray-800/50">
                {['Category', 'Slug', 'Commission', 'GST', 'Listings', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-nm-text-muted dark:text-nm-text-dark-muted uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-nm-border dark:divide-nm-border-dark">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : categories.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-nm-text-muted dark:text-nm-text-dark-muted">
                    <Tag size={32} className="mx-auto mb-2 opacity-40" />
                    <p>No categories found. Create your first one.</p>
                  </td>
                </tr>
              ) : (
                categories.map((cat) => (
                  <tr
                    key={cat.id}
                    className={`transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40 ${
                      cat.status === 'inactive' ? 'opacity-50' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-nm-text dark:text-nm-text-dark">{cat.name}</div>
                      {cat.isAiGenerated && (
                        <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full dark:bg-purple-900/30 dark:text-purple-400">
                          AI
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded font-mono text-nm-text-muted dark:text-nm-text-dark-muted">
                        {cat.slug}
                      </code>
                    </td>
                    <td className="px-4 py-3 font-medium text-nm-text dark:text-nm-text-dark">
                      {((cat.commissionRate || 0) * 100).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-nm-text-muted dark:text-nm-text-dark-muted">
                      {((cat.gstRate || 0) * 100).toFixed(0)}%
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-nm-text dark:text-nm-text-dark">
                        {cat.listingCount || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        cat.status === 'active'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                      }`}>
                        {cat.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            setEditTarget({
                              ...cat,
                              // Pre-fill form with % values (not decimal)
                            })
                          }
                          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-nm-text-muted dark:text-nm-text-dark-muted transition-colors"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => toggleMutation.mutate(cat.id)}
                          disabled={toggleMutation.isPending}
                          className={`p-1.5 rounded transition-colors ${
                            cat.status === 'active'
                              ? 'hover:bg-red-50 text-red-500 dark:hover:bg-red-900/20'
                              : 'hover:bg-green-50 text-green-600 dark:hover:bg-green-900/20'
                          }`}
                          title={cat.status === 'active' ? 'Deactivate' : 'Activate'}
                        >
                          {cat.status === 'active' ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <Modal title="Add Category" onClose={() => setShowCreate(false)}>
          <CategoryForm
            initial={EMPTY_FORM}
            submitLabel="Create Category"
            loading={createMutation.isPending}
            onSubmit={(form) => createMutation.mutate(form)}
          />
        </Modal>
      )}

      {/* Edit Modal */}
      {editTarget && (
        <Modal title={`Edit: ${editTarget.name}`} onClose={() => setEditTarget(null)}>
          <CategoryForm
            initial={{
              name: editTarget.name,
              slug: editTarget.slug,
              commission_rate: ((editTarget.commissionRate || 0) * 100).toFixed(1),
              gst_rate: ((editTarget.gstRate || 0) * 100).toFixed(0),
            }}
            submitLabel="Save Changes"
            loading={updateMutation.isPending}
            onSubmit={(form) => updateMutation.mutate({ id: editTarget.id, form })}
          />
        </Modal>
      )}
    </div>
  );
}
