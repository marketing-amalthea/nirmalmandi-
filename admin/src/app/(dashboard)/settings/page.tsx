'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '@/lib/api';
import {
  Settings, Save, RefreshCw, CheckCircle2, AlertCircle, X,
  Building2, CreditCard, Shield, Bell, Wrench, IndianRupee,
} from 'lucide-react';

type SettingsMap = Record<string, string>;

interface SettingFieldProps {
  label: string;
  description?: string;
  value: string;
  type?: 'text' | 'number' | 'email' | 'tel' | 'toggle';
  min?: string;
  max?: string;
  step?: string;
  placeholder?: string;
  onChange: (v: string) => void;
}

function SettingField({ label, description, value, type = 'text', min, max, step, placeholder, onChange }: SettingFieldProps) {
  if (type === 'toggle') {
    const isOn = value === 'true';
    return (
      <div className="flex items-center justify-between py-3 border-b border-nm-border dark:border-nm-border-dark last:border-0">
        <div className="mr-4">
          <p className="text-sm font-medium text-nm-text dark:text-nm-text-dark">{label}</p>
          {description && <p className="text-xs text-nm-text-muted dark:text-nm-text-dark-muted mt-0.5">{description}</p>}
        </div>
        <button
          type="button"
          onClick={() => onChange(isOn ? 'false' : 'true')}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-nm-primary focus:ring-offset-1 shrink-0 ${
            isOn ? 'bg-nm-primary' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${isOn ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>
    );
  }

  return (
    <div className="py-3 border-b border-nm-border dark:border-nm-border-dark last:border-0">
      <label className="block text-sm font-medium text-nm-text dark:text-nm-text-dark mb-0.5">{label}</label>
      {description && <p className="text-xs text-nm-text-muted dark:text-nm-text-dark-muted mb-1.5">{description}</p>}
      <input
        type={type}
        value={value}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-nm-border dark:border-nm-border-dark bg-white dark:bg-gray-700 rounded-lg px-3 py-2 text-sm text-nm-text dark:text-nm-text-dark focus:outline-none focus:ring-2 focus:ring-nm-primary"
      />
    </div>
  );
}

function SettingsSection({ icon: Icon, title, children }: {
  icon: React.ElementType; title: string; children: React.ReactNode;
}) {
  return (
    <section className="nm-card overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 bg-gray-50 dark:bg-gray-800/50 border-b border-nm-border dark:border-nm-border-dark">
        <div className="w-7 h-7 bg-nm-primary/10 rounded-lg flex items-center justify-center">
          <Icon size={14} className="text-nm-primary" />
        </div>
        <h2 className="font-semibold text-nm-text dark:text-nm-text-dark text-sm">{title}</h2>
      </div>
      <div className="px-5">{children}</div>
    </section>
  );
}

export default function SettingsPage() {
  const qc = useQueryClient();
  const [local, setLocal] = useState<SettingsMap>({});
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await settingsApi.getSettings();
      return (res.data?.data ?? {}) as SettingsMap;
    },
    retry: 1,
  });

  // Sync remote → local when first loaded
  useEffect(() => {
    if (data && !dirty) setLocal(data);
  }, [data, dirty]);

  const saveMutation = useMutation({
    mutationFn: () => settingsApi.updateSettings(local),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      setDirty(false);
      setToast({ type: 'success', text: 'Settings saved successfully' });
      setTimeout(() => setToast(null), 4000);
    },
    onError: () => {
      setToast({ type: 'error', text: 'Failed to save settings' });
      setTimeout(() => setToast(null), 4000);
    },
  });

  const set = (key: string) => (value: string) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const get = (key: string) => local[key] ?? data?.[key] ?? '';

  const resetChanges = () => {
    setLocal(data ?? {});
    setDirty(false);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-5">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48 animate-pulse" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="nm-card p-6 space-y-4">
            {Array.from({ length: 3 }).map((__, j) => (
              <div key={j} className="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-nm-text dark:text-nm-text-dark flex items-center gap-2">
            <Settings size={22} />
            Platform Settings
          </h1>
          <p className="text-sm text-nm-text-muted dark:text-nm-text-dark-muted mt-0.5">
            Configure NirmalMandi platform behaviour, rates, and features
          </p>
        </div>
        <div className="flex gap-2">
          {dirty && (
            <button onClick={resetChanges} className="nm-btn-secondary text-sm flex items-center gap-2">
              <RefreshCw size={14} />
              Reset
            </button>
          )}
          <button
            onClick={() => saveMutation.mutate()}
            disabled={!dirty || saveMutation.isPending}
            className="nm-btn-primary text-sm flex items-center gap-2 disabled:opacity-50"
          >
            <Save size={14} />
            {saveMutation.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Unsaved changes banner */}
      {dirty && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-800 dark:text-yellow-300">
          <AlertCircle size={14} />
          You have unsaved changes
        </div>
      )}

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

      {/* Section: Platform Identity */}
      <SettingsSection icon={Building2} title="Platform Identity">
        <SettingField
          label="Platform Name"
          value={get('platform_name')}
          onChange={set('platform_name')}
        />
        <SettingField
          label="GSTIN"
          description="Platform's GST registration number for invoicing"
          value={get('platform_gstin')}
          onChange={set('platform_gstin')}
          placeholder="22AAAAA0000A1Z5"
        />
        <SettingField
          label="PAN"
          description="Used for TDS/TCS reporting"
          value={get('platform_pan')}
          onChange={set('platform_pan')}
        />
        <SettingField
          label="Support Email"
          type="email"
          value={get('support_email')}
          onChange={set('support_email')}
        />
        <SettingField
          label="Support Phone"
          type="tel"
          value={get('support_phone')}
          onChange={set('support_phone')}
          placeholder="+91 XXXXX XXXXX"
        />
      </SettingsSection>

      {/* Section: Fees & Rates */}
      <SettingsSection icon={IndianRupee} title="Fees & Rates">
        <SettingField
          label="Default Commission Rate (%)"
          description="Applied to sectors that don't have a custom rate"
          type="number"
          min="0"
          max="50"
          step="0.1"
          value={get('default_commission_rate')}
          onChange={set('default_commission_rate')}
        />
        <SettingField
          label="TCS Rate (%)"
          description="Tax Collected at Source under Section 194-O (typically 1%)"
          type="number"
          min="0"
          max="5"
          step="0.1"
          value={get('tcs_rate')}
          onChange={set('tcs_rate')}
        />
        <SettingField
          label="Minimum Order Value (₹)"
          description="Orders below this amount will be rejected"
          type="number"
          min="0"
          step="100"
          value={get('min_order_value')}
          onChange={set('min_order_value')}
        />
      </SettingsSection>

      {/* Section: Escrow & Dispute */}
      <SettingsSection icon={Shield} title="Escrow & Dispute">
        <SettingField
          label="Auto-Release Days"
          description="Escrow released automatically after N days if buyer doesn't confirm"
          type="number"
          min="1"
          max="30"
          value={get('auto_release_days')}
          onChange={set('auto_release_days')}
        />
        <SettingField
          label="Dispute SLA (hours)"
          description="Time for admin to resolve a dispute before escalation"
          type="number"
          min="1"
          max="720"
          value={get('dispute_sla_hours')}
          onChange={set('dispute_sla_hours')}
        />
      </SettingsSection>

      {/* Section: Listing Config */}
      <SettingsSection icon={CreditCard} title="Listing Configuration">
        <SettingField
          label="Max Images per Listing"
          type="number"
          min="1"
          max="20"
          value={get('max_listing_images')}
          onChange={set('max_listing_images')}
        />
        <SettingField
          label="Enable Flash Sales"
          type="toggle"
          value={get('enable_flash_sales')}
          onChange={set('enable_flash_sales')}
        />
        <SettingField
          label="Enable Auctions"
          type="toggle"
          value={get('enable_auctions')}
          onChange={set('enable_auctions')}
        />
      </SettingsSection>

      {/* Section: Registrations & Feature Flags */}
      <SettingsSection icon={Bell} title="Registrations & Features">
        <SettingField
          label="Allow Buyer Registration"
          description="New buyers can sign up"
          type="toggle"
          value={get('enable_buyer_registration')}
          onChange={set('enable_buyer_registration')}
        />
        <SettingField
          label="Allow Seller Registration"
          description="New sellers can apply to list inventory"
          type="toggle"
          value={get('enable_seller_registration')}
          onChange={set('enable_seller_registration')}
        />
        <SettingField
          label="WhatsApp Notifications"
          description="Send order/payment alerts via WhatsApp"
          type="toggle"
          value={get('enable_whatsapp_notifications')}
          onChange={set('enable_whatsapp_notifications')}
        />
      </SettingsSection>

      {/* Section: KPI Alert Thresholds */}
      <SettingsSection icon={AlertCircle} title="KPI Alert Thresholds">
        <SettingField
          label="GMV Drop Alert (%)"
          description="Trigger alert when weekly GMV drops by this % WoW"
          type="number"
          min="1" max="100" step="1"
          placeholder="20"
          value={get('alert_gmv_drop_pct')}
          onChange={set('alert_gmv_drop_pct')}
        />
        <SettingField
          label="Dispute Rate Alert (%)"
          description="Flag sellers whose dispute rate exceeds this %"
          type="number"
          min="0" max="100" step="0.5"
          placeholder="5"
          value={get('alert_dispute_rate_pct')}
          onChange={set('alert_dispute_rate_pct')}
        />
        <SettingField
          label="Inventory Aging Alert (days)"
          description="Flag listings that haven't sold after this many days"
          type="number"
          min="7" max="180" step="1"
          placeholder="30"
          value={get('alert_aging_days')}
          onChange={set('alert_aging_days')}
        />
        <SettingField
          label="Low CVR Alert (%)"
          description="Alert when seller's conversion rate drops below this %"
          type="number"
          min="0" max="20" step="0.5"
          placeholder="1"
          value={get('alert_low_cvr_pct')}
          onChange={set('alert_low_cvr_pct')}
        />
        <SettingField
          label="Weekly Report Recipients"
          description="Comma-separated emails — receives Monday 8AM IST auto-report"
          type="email"
          placeholder="admin@nirmalmandi.com, cfo@nirmalmandi.com"
          value={get('weekly_report_emails')}
          onChange={set('weekly_report_emails')}
        />
      </SettingsSection>

      {/* Section: Maintenance */}
      <SettingsSection icon={Wrench} title="Maintenance">
        <SettingField
          label="Maintenance Mode"
          description="When enabled, the marketplace shows a maintenance page to all users"
          type="toggle"
          value={get('maintenance_mode')}
          onChange={set('maintenance_mode')}
        />
      </SettingsSection>

      {/* Save button (bottom) */}
      <div className="flex justify-end pb-4">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={!dirty || saveMutation.isPending}
          className="nm-btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          <Save size={16} />
          {saveMutation.isPending ? 'Saving…' : 'Save All Changes'}
        </button>
      </div>
    </div>
  );
}
