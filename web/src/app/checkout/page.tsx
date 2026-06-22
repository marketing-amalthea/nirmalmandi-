'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Script from 'next/script';
import Link from 'next/link';
import {
  ArrowLeft, Package, Loader2, AlertCircle, Truck, Shield,
  Plus, Lock, MapPin, Store, Hand,
} from 'lucide-react';
import { toast } from 'sonner';
import { TopNav, inr } from '@/components/ui';
import TierVerifyModal from '@/components/TierVerifyModal';
import { inventoryApi, ordersApi, paymentsApi, addressApi, logisticsApi, type Address, type Listing } from '@/lib/api';
import { isAuthenticated, getUser } from '@/lib/auth';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu & Kashmir', 'Ladakh',
];

const PLATFORM_FEE_PCT = 2.5;
const GST_ON_FEE_PCT = 18;

type FreightType = 'self_ship' | 'platform_logistics' | 'buyer_pickup';

interface NewAddressForm {
  name: string; phone: string; address_line1: string; address_line2: string;
  city: string; state: string; pincode: string; save_for_future: boolean;
}

const FREIGHT_OPTS: { value: FreightType; label: string; subtitle: string; icon: typeof Truck }[] = [
  { value: 'platform_logistics', label: 'Platform logistics â€” Delhivery', subtitle: 'NirmalMandi arranges pickup & delivery Â· 2â€“4 days', icon: Truck },
  { value: 'self_ship', label: 'Seller ship', subtitle: 'Seller arranges delivery Â· 3â€“7 days', icon: Store },
  { value: 'buyer_pickup', label: 'Buyer pickup', subtitle: 'Coordinate pickup directly with seller', icon: Hand },
];

export default function CheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const listingId = searchParams.get('listing_id') ?? '';
  const quantityParam = Number(searchParams.get('quantity') ?? 1);

  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [newAddress, setNewAddress] = useState<NewAddressForm>({
    name: '', phone: '', address_line1: '', address_line2: '',
    city: '', state: '', pincode: '', save_for_future: true,
  });
  const [freightType, setFreightType] = useState<FreightType | ''>('');
  const [freightEstimate, setFreightEstimate] = useState<number | null>(null);
  const [loadingFreight, setLoadingFreight] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [razorpayReady, setRazorpayReady] = useState(false);
  const [tierModal, setTierModal] = useState<2 | 3 | null>(null);
  const [tierVerified, setTierVerified] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      toast.error('Please login to checkout');
      router.push('/login');
    }
  }, [router]);

  const { data: listing, isLoading: loadingListing, isError: listingError } = useQuery({
    queryKey: ['listing', listingId],
    queryFn: () => inventoryApi.getListing(listingId),
    select: (res) => {
      const raw = (res.data as unknown as { data: Record<string, unknown> })?.data ?? null;
      return raw as unknown as Listing & Record<string, unknown>;
    },
    enabled: !!listingId,
  });

  const { data: addresses, isLoading: loadingAddresses } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => addressApi.getAddresses(),
    select: (res) => {
      const payload = res.data as unknown as { data?: Address[] } | Address[];
      if (Array.isArray(payload)) return payload;
      return payload?.data ?? [];
    },
    enabled: isAuthenticated(),
  });

  const addressList: Address[] = Array.isArray(addresses) ? addresses : [];

  useEffect(() => {
    if (addressList.length > 0 && !selectedAddressId) setSelectedAddressId(addressList[0].id);
  }, [addressList, selectedAddressId]);

  const selectedAddress = addressList.find((a) => a.id === selectedAddressId) ?? null;
  const quantity = quantityParam;

  const fetchFreightEstimate = useCallback(async () => {
    if (!listing || !selectedAddress) return;
    setLoadingFreight(true);
    try {
      const weightKg = Math.max(0.5, Math.ceil(quantity * 0.5));
      const res = await logisticsApi.getFreightEstimate({
        origin_pincode: String((listing as unknown as Record<string, unknown>).pincode ?? '110001'),
        dest_pincode: selectedAddress.pincode,
        weight_kg: weightKg,
      });
      const est = res.data?.data?.estimated_cost ?? 0;
      setFreightEstimate(Number(est));
    } catch {
      setFreightEstimate(null);
      toast.error('Could not estimate freight. Please try again.');
    } finally {
      setLoadingFreight(false);
    }
  }, [listing, selectedAddress, quantity]);

  useEffect(() => {
    if (freightType === 'platform_logistics' && selectedAddress) fetchFreightEstimate();
  }, [freightType, selectedAddress, fetchFreightEstimate]);

  const pricePerUnit = Number((listing as unknown as Record<string, unknown> | null)?.asking_price ?? (listing as unknown as Record<string, unknown> | null)?.price_per_unit ?? 0);
  const subtotal = pricePerUnit * quantity;
  const platformFee = (subtotal * PLATFORM_FEE_PCT) / 100;
  const gstOnFee = (platformFee * GST_ON_FEE_PCT) / 100;
  const freight = freightType === 'platform_logistics'
    ? (freightEstimate ?? null)
    : freightType === 'self_ship' || freightType === 'buyer_pickup' ? 0 : null;
  const total = subtotal + platformFee + gstOnFee + (freight ?? 0);

  function validateForm(): boolean {
    if (!selectedAddressId && !showNewAddressForm) { toast.error('Please select or add a delivery address'); return false; }
    if (showNewAddressForm) {
      if (!newAddress.name.trim()) { toast.error('Name is required'); return false; }
      if (!/^[6-9]\d{9}$/.test(newAddress.phone)) { toast.error('Enter a valid 10-digit mobile number'); return false; }
      if (!newAddress.address_line1.trim()) { toast.error('Address Line 1 is required'); return false; }
      if (!newAddress.city.trim()) { toast.error('City is required'); return false; }
      if (!newAddress.state) { toast.error('State is required'); return false; }
      if (!/^\d{6}$/.test(newAddress.pincode)) { toast.error('Enter a valid 6-digit pincode'); return false; }
    }
    if (!freightType) { toast.error('Please select a freight option'); return false; }
    return true;
  }

  async function handlePay() {
    if (!validateForm()) return;
    if (!razorpayReady) { toast.error('Payment gateway is loading. Please try again.'); return; }

    if (!tierVerified) {
      if (total >= 10_00_000) { setTierModal(3); return; }
      if (total >= 1_00_000) { setTierModal(2); return; }
    }

    setPlacing(true);
    try {
      let deliveryAddress: Address | undefined;
      if (showNewAddressForm) {
        const res = await addressApi.addAddress({
          name: newAddress.name,
          phone: newAddress.phone,
          address_line1: newAddress.address_line1,
          address_line2: newAddress.address_line2 || undefined,
          city: newAddress.city,
          state: newAddress.state,
          pincode: newAddress.pincode,
          save_for_future: newAddress.save_for_future,
        });
        deliveryAddress = (res.data as unknown as { data?: Address } | Address)
          ? ((res.data as unknown as { data?: Address })?.data ?? res.data as unknown as Address)
          : undefined;
      } else {
        deliveryAddress = selectedAddress ?? undefined;
      }

      const orderRes = await ordersApi.placeOrder({
        listing_id: listingId,
        quantity,
        delivery_address: deliveryAddress,
        freight_type: freightType,
      });
      const orderPayload = (orderRes.data as unknown as { data?: { orderId: string; order_number: string } } | { orderId: string; order_number: string });
      const orderId = (orderPayload as { data?: { orderId: string } })?.data?.orderId
        ?? (orderPayload as { orderId?: string })?.orderId ?? '';

      const totalPaisa = Math.round(total * 100);
      const payRes = await paymentsApi.initiatePayment(orderId, totalPaisa);
      const payPayload = (payRes.data as unknown as { data?: { razorpay_order_id: string; razorpay_key: string; amount: number } } | { razorpay_order_id: string; razorpay_key: string; amount: number });
      const rzpData = (payPayload as { data?: { razorpay_order_id: string; razorpay_key: string; amount: number } })?.data
        ?? payPayload as { razorpay_order_id: string; razorpay_key: string; amount: number };

      const user = getUser();

      const rzp = new (window as unknown as { Razorpay: new (opts: Record<string, unknown>) => { open(): void } }).Razorpay({
        key: rzpData.razorpay_key,
        amount: rzpData.amount,
        order_id: rzpData.razorpay_order_id,
        name: 'NirmalMandi',
        description: String((listing as unknown as Record<string, unknown> | null)?.title ?? 'Inventory Purchase'),
        prefill: { name: user?.name ?? '', contact: user?.phone ?? '' },
        theme: { color: '#1f6b3a' },
        handler: () => { router.push(`/orders/${orderId}?paid=true`); },
        modal: { ondismiss: () => { setPlacing(false); } },
      });
      rzp.open();
    } catch (err) {
      console.error(err);
      toast.error('Payment failed. Please try again.');
      setPlacing(false);
    }
  }

  if (loadingListing) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--nm-paper)' }}>
        <TopNav />
        <div className="flex items-center justify-center" style={{ padding: '80px 0' }}><Loader2 size={28} className="animate-spin" style={{ color: 'var(--nm-green)' }} /></div>
      </div>
    );
  }

  if (listingError || !listing) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--nm-paper)' }}>
        <TopNav />
        <div className="flex flex-col items-center justify-center gap-4 text-center" style={{ padding: '80px 16px' }}>
          <AlertCircle size={48} style={{ color: 'var(--nm-red)' }} />
          <h2 className="disp" style={{ fontSize: 20, fontWeight: 700, color: 'var(--nm-ink)' }}>Listing not found</h2>
          <Link href="/listings" className="nm-btn-primary no-underline">Browse listings</Link>
        </div>
      </div>
    );
  }

  const l = listing as unknown as Record<string, unknown>;
  const grade = String(l.condition_grade ?? '');
  const payDisabled = placing || !freightType || loadingFreight || (freightType === 'platform_logistics' && freightEstimate === null);

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" onReady={() => setRazorpayReady(true)} />
      {tierModal && (
        <TierVerifyModal
          tier={tierModal}
          orderAmount={total}
          onVerified={() => { setTierVerified(true); setTierModal(null); handlePay(); }}
          onClose={() => setTierModal(null)}
        />
      )}
      <div style={{ minHeight: '100vh', background: 'var(--nm-paper)' }}>
        <TopNav />

        {/* Escrow pill */}
        <div className="flex justify-center" style={{ paddingTop: 22 }}>
          <span className="nm-pill" style={{ background: 'var(--nm-green-soft)', color: 'var(--nm-green)', fontWeight: 700, fontSize: 12.5, padding: '7px 16px' }}>
            <Shield size={14} /> Escrow-protected checkout
          </span>
        </div>

        <main style={{ maxWidth: 1080, margin: '0 auto', width: '100%', padding: '20px 24px 56px' }}>
          <Link href={`/listings/${listingId}`} className="inline-flex items-center gap-1.5 no-underline" style={{ fontSize: 13.5, color: 'var(--nm-muted)', fontWeight: 600, marginBottom: 20 }}>
            <ArrowLeft size={16} /> Back to listing
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr]" style={{ gap: 32 }}>
            {/* â”€â”€ Summary â”€â”€ */}
            <div>
              <div className="sticky" style={{ top: 24 }}>
                <div className="nm-card" style={{ padding: 20 }}>
                  {/* Product mini-card */}
                  <div className="nm-card flex items-center gap-3" style={{ padding: 14, marginBottom: 18 }}>
                    <div className="flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ width: 48, height: 48, borderRadius: 10, background: 'var(--nm-panel)' }}>
                      {Array.isArray(l.images) && (l.images as string[]).length > 0
                        ? <img src={(l.images as string[])[0]} alt="" className="w-full h-full object-cover" />
                        : <Package size={22} style={{ color: 'var(--nm-faint)' }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="disp" style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--nm-ink)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{String(l.title ?? '')}</p>
                      <p style={{ fontSize: 12, color: 'var(--nm-muted)', margin: '2px 0 0' }}>{String(l.seller_business_name ?? l.seller_name ?? 'Seller')}</p>
                    </div>
                    {grade && (
                      <span className="nm-pill flex-shrink-0" style={{ background: 'var(--nm-gold-soft)', color: 'var(--nm-gold-ink)', fontSize: 11 }}>Grade {grade}</span>
                    )}
                  </div>

                  {/* Line items */}
                  <div className="flex flex-col">
                    <LineItem label={`Subtotal (${quantity} Ã— ${inr(pricePerUnit)})`} value={inr(subtotal)} />
                    <LineItem label={`Platform fee (${PLATFORM_FEE_PCT}%)`} value={inr(platformFee)} />
                    <LineItem label={`GST on fee (${GST_ON_FEE_PCT}%)`} value={inr(gstOnFee)} />
                    <LineItem
                      label="Freight"
                      valueNode={
                        loadingFreight ? <span style={{ color: 'var(--nm-faint)' }}>Calculatingâ€¦</span>
                          : freight === null && !freightType ? <span style={{ color: 'var(--nm-faint)', fontStyle: 'italic' }}>Select option</span>
                          : freight === null && freightType === 'platform_logistics' ? <span style={{ color: 'var(--nm-red)', fontStyle: 'italic', fontSize: 12 }}>Unavailable</span>
                          : freight === 0 ? <span style={{ color: 'var(--nm-green)', fontWeight: 700 }}>Free</span>
                          : <span className="num" style={{ color: 'var(--nm-ink)' }}>{inr(freight ?? 0)}</span>
                      }
                    />
                  </div>

                  <div style={{ borderTop: '1px dashed var(--nm-line)', margin: '14px 0' }} />

                  <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
                    <span className="disp" style={{ fontSize: 16, fontWeight: 700, color: 'var(--nm-ink)' }}>Total</span>
                    <span className="num" style={{ fontSize: 20, fontWeight: 800, color: 'var(--nm-green)' }}>{inr(total)}</span>
                  </div>

                  <div className="flex items-start gap-2.5" style={{ background: 'var(--nm-green-soft)', borderRadius: 12, padding: 14 }}>
                    <Shield size={18} style={{ color: 'var(--nm-green)', flexShrink: 0, marginTop: 1 }} />
                    <p style={{ fontSize: 12.5, color: 'var(--nm-green)', margin: 0, lineHeight: 1.45 }}>Your payment is held in escrow until you confirm delivery.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* â”€â”€ Form â”€â”€ */}
            <div className="flex flex-col" style={{ gap: 28 }}>
              {/* Section 1: Delivery address */}
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--nm-faint)', margin: '0 0 12px' }}>Delivery address</p>
                {loadingAddresses ? (
                  <div className="flex items-center gap-2" style={{ fontSize: 13, color: 'var(--nm-faint)' }}>
                    <Loader2 size={16} className="animate-spin" /> Loading addressesâ€¦
                  </div>
                ) : (
                  <div className="flex flex-col" style={{ gap: 10 }}>
                    {addressList.map((addr) => {
                      const sel = selectedAddressId === addr.id && !showNewAddressForm;
                      return (
                        <label key={addr.id} className="flex items-start gap-3 cursor-pointer" style={{
                          padding: 14, borderRadius: 12,
                          border: sel ? '1.5px solid var(--nm-green)' : '1px solid var(--nm-line)',
                          background: sel ? 'var(--nm-green-soft)' : 'var(--nm-card)',
                        }}>
                          <input type="radio" name="address" checked={sel} onChange={() => { setSelectedAddressId(addr.id); setShowNewAddressForm(false); }} style={{ marginTop: 3, accentColor: 'var(--nm-green)' }} />
                          <div style={{ fontSize: 13 }}>
                            <p className="disp" style={{ fontWeight: 700, color: 'var(--nm-ink)', margin: 0 }}>{addr.name}</p>
                            <p style={{ color: 'var(--nm-muted)', margin: '2px 0 0' }}>{addr.address_line1}{addr.address_line2 ? `, ${addr.address_line2}` : ''}</p>
                            <p style={{ color: 'var(--nm-muted)', margin: 0 }}>{addr.city}, {addr.state} â€” {addr.pincode}</p>
                            <p style={{ color: 'var(--nm-faint)', margin: '2px 0 0' }}>{addr.phone}</p>
                          </div>
                        </label>
                      );
                    })}

                    <label className="flex items-center gap-3 cursor-pointer" style={{
                      padding: 14, borderRadius: 12,
                      border: showNewAddressForm ? '1.5px solid var(--nm-green)' : '1px dashed var(--nm-line)',
                      background: showNewAddressForm ? 'var(--nm-green-soft)' : 'transparent',
                    }}>
                      <input type="radio" name="address" checked={showNewAddressForm} onChange={() => { setShowNewAddressForm(true); setSelectedAddressId(''); }} style={{ accentColor: 'var(--nm-green)' }} />
                      <span className="flex items-center gap-1.5" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--nm-green)' }}><Plus size={16} /> Add new address</span>
                    </label>

                    {showNewAddressForm && (
                      <div className="flex flex-col" style={{ gap: 12, paddingTop: 4 }}>
                        <div className="grid grid-cols-2" style={{ gap: 12 }}>
                          <div>
                            <label className="nm-label">Full name *</label>
                            <input value={newAddress.name} onChange={(e) => setNewAddress((p) => ({ ...p, name: e.target.value }))} className="nm-input" placeholder="Raj Kumar" />
                          </div>
                          <div>
                            <label className="nm-label">Phone *</label>
                            <input value={newAddress.phone} onChange={(e) => setNewAddress((p) => ({ ...p, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))} className="nm-input" placeholder="9876543210" inputMode="numeric" />
                          </div>
                        </div>
                        <div>
                          <label className="nm-label">Address line 1 *</label>
                          <input value={newAddress.address_line1} onChange={(e) => setNewAddress((p) => ({ ...p, address_line1: e.target.value }))} className="nm-input" placeholder="Plot no, Street, Area" />
                        </div>
                        <div>
                          <label className="nm-label">Address line 2</label>
                          <input value={newAddress.address_line2} onChange={(e) => setNewAddress((p) => ({ ...p, address_line2: e.target.value }))} className="nm-input" placeholder="Landmark, Building (optional)" />
                        </div>
                        <div className="grid grid-cols-2" style={{ gap: 12 }}>
                          <div>
                            <label className="nm-label">City *</label>
                            <input value={newAddress.city} onChange={(e) => setNewAddress((p) => ({ ...p, city: e.target.value }))} className="nm-input" placeholder="Mumbai" />
                          </div>
                          <div>
                            <label className="nm-label">Pincode *</label>
                            <input value={newAddress.pincode} onChange={(e) => setNewAddress((p) => ({ ...p, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))} className="nm-input" placeholder="400001" inputMode="numeric" />
                          </div>
                        </div>
                        <div>
                          <label className="nm-label">State *</label>
                          <select value={newAddress.state} onChange={(e) => setNewAddress((p) => ({ ...p, state: e.target.value }))} className="nm-select">
                            <option value="">Select state</option>
                            {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer" style={{ fontSize: 13, color: 'var(--nm-muted)' }}>
                          <input type="checkbox" checked={newAddress.save_for_future} onChange={(e) => setNewAddress((p) => ({ ...p, save_for_future: e.target.checked }))} style={{ accentColor: 'var(--nm-green)' }} />
                          Save address for future orders
                        </label>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Section 2: Freight */}
              {(selectedAddressId || showNewAddressForm) && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--nm-faint)', margin: '0 0 12px' }}>Freight option</p>
                  <div className="flex flex-col" style={{ gap: 10 }}>
                    {FREIGHT_OPTS.map((opt) => {
                      const sel = freightType === opt.value;
                      const Icon = opt.icon;
                      const cost = opt.value === 'platform_logistics'
                        ? (loadingFreight ? 'Calculatingâ€¦' : freightEstimate !== null && sel ? inr(freightEstimate) : 'See estimate')
                        : 'Free';
                      return (
                        <label key={opt.value} className="nm-card flex items-start gap-3 cursor-pointer" style={{
                          padding: 16,
                          border: sel ? '1.5px solid var(--nm-green)' : '1px solid var(--nm-line)',
                          background: sel ? 'var(--nm-green-soft)' : 'var(--nm-card)',
                        }}>
                          <input type="radio" name="freight" checked={sel} onChange={() => setFreightType(opt.value)} style={{ marginTop: 2, accentColor: 'var(--nm-green)' }} />
                          <Icon size={18} style={{ color: 'var(--nm-green)', flexShrink: 0, marginTop: 1 }} />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="disp" style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--nm-ink)' }}>{opt.label}</span>
                              <span className="num" style={{ fontSize: 13.5, fontWeight: 700, color: cost === 'Free' ? 'var(--nm-green)' : 'var(--nm-ink)' }}>{cost}</span>
                            </div>
                            <p style={{ fontSize: 12, color: 'var(--nm-muted)', margin: '3px 0 0' }}>{opt.subtitle}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tier gate */}
              {total >= 1_00_000 && (
                <div className="flex items-start gap-3" style={{ background: 'var(--nm-gold-soft)', borderRadius: 12, padding: 16 }}>
                  <Lock size={18} style={{ color: 'var(--nm-gold-ink)', flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p className="disp" style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--nm-gold-ink)', margin: 0 }}>High-value order verification</p>
                    <p style={{ fontSize: 12.5, color: 'var(--nm-gold-ink)', margin: '3px 0 0', lineHeight: 1.45 }}>
                      Orders above {inr(total >= 10_00_000 ? 10_00_000 : 1_00_000)} require a quick identity check before payment.
                    </p>
                  </div>
                </div>
              )}

              {/* Pay button */}
              <button onClick={handlePay} disabled={payDisabled} className="nm-btn-primary" style={{ width: '100%', padding: '15px 24px', fontSize: 15.5, opacity: payDisabled ? 0.55 : 1, cursor: payDisabled ? 'not-allowed' : 'pointer' }}>
                {placing ? <><Loader2 size={18} className="animate-spin" /> Processingâ€¦</> : <><Lock size={16} /> Pay {inr(total)} securely</>}
              </button>
              <p className="text-center" style={{ fontSize: 11.5, color: 'var(--nm-faint)', margin: '-12px 0 0' }}>UPI Â· Cards Â· NEFT Â· RTGS via Razorpay Â· 256-bit SSL</p>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

function LineItem({ label, value, valueNode }: { label: string; value?: string; valueNode?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between" style={{ padding: '9px 0', borderBottom: '1px solid var(--nm-line-soft)' }}>
      <span style={{ fontSize: 13, color: 'var(--nm-muted)' }}>{label}</span>
      <span className="num" style={{ fontSize: 13.5, color: 'var(--nm-ink)' }}>{valueNode ?? value}</span>
    </div>
  );
}
