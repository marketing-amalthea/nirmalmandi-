'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Script from 'next/script';
import Link from 'next/link';
import {
  ArrowLeft, Package, Loader2, AlertCircle, MapPin, Truck, ChevronDown, ChevronUp,
  Lock, CheckCircle, Plus, IndianRupee
} from 'lucide-react';
import { toast } from 'sonner';
import Header from '@/components/Header';
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
  name: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  pincode: string;
  save_for_future: boolean;
}

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
  const [escrowCollapsed, setEscrowCollapsed] = useState(false);
  const [razorpayReady, setRazorpayReady] = useState(false);
  const [tierModal, setTierModal] = useState<2 | 3 | null>(null);
  const [tierVerified, setTierVerified] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated()) {
      toast.error('Please login to checkout');
      router.push('/login');
    }
  }, [router]);

  // Collapse escrow box after first view
  useEffect(() => {
    const seen = localStorage.getItem('nm_escrow_seen');
    if (seen) setEscrowCollapsed(true);
  }, []);

  function handleEscrowToggle() {
    if (!escrowCollapsed) {
      localStorage.setItem('nm_escrow_seen', '1');
    }
    setEscrowCollapsed((v) => !v);
  }

  // Fetch listing
  const { data: listing, isLoading: loadingListing, isError: listingError } = useQuery({
    queryKey: ['listing', listingId],
    queryFn: () => inventoryApi.getListing(listingId),
    select: (res) => {
      const raw = (res.data as unknown as { data: Record<string, unknown> })?.data ?? null;
      return raw as unknown as Listing & Record<string, unknown>;
    },
    enabled: !!listingId,
  });

  // Fetch saved addresses
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

  // Auto-select first address
  useEffect(() => {
    if (addressList.length > 0 && !selectedAddressId) {
      setSelectedAddressId(addressList[0].id);
    }
  }, [addressList, selectedAddressId]);

  const selectedAddress = addressList.find((a) => a.id === selectedAddressId) ?? null;

  const quantity = quantityParam;

  // Fetch freight estimate when platform_logistics selected and address chosen
  const fetchFreightEstimate = useCallback(async () => {
    if (!listing || !selectedAddress) return;
    setLoadingFreight(true);
    try {
      // Rough weight: 0.5 kg per unit, min 0.5 kg
      const weightKg = Math.max(0.5, Math.ceil(quantity * 0.5));
      const res = await logisticsApi.getFreightEstimate({
        origin_pincode: String((listing as Record<string, unknown>).pincode ?? '110001'),
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
    if (freightType === 'platform_logistics' && selectedAddress) {
      fetchFreightEstimate();
    }
  }, [freightType, selectedAddress, fetchFreightEstimate]);

  // Amount calculations
  const pricePerUnit = Number((listing as Record<string, unknown> | null)?.asking_price ?? (listing as Record<string, unknown> | null)?.price_per_unit ?? 0);
  const subtotal = pricePerUnit * quantity;
  const platformFee = (subtotal * PLATFORM_FEE_PCT) / 100;
  const gstOnFee = (platformFee * GST_ON_FEE_PCT) / 100;
  const freight = freightType === 'platform_logistics'
    ? (freightEstimate ?? null)
    : freightType === 'self_ship' || freightType === 'buyer_pickup'
      ? 0
      : null;
  const total = subtotal + platformFee + gstOnFee + (freight ?? 0);

  function validateForm(): boolean {
    if (!selectedAddressId && !showNewAddressForm) {
      toast.error('Please select or add a delivery address');
      return false;
    }
    if (showNewAddressForm) {
      if (!newAddress.name.trim()) { toast.error('Name is required'); return false; }
      if (!/^[6-9]\d{9}$/.test(newAddress.phone)) { toast.error('Enter a valid 10-digit mobile number'); return false; }
      if (!newAddress.address_line1.trim()) { toast.error('Address Line 1 is required'); return false; }
      if (!newAddress.city.trim()) { toast.error('City is required'); return false; }
      if (!newAddress.state) { toast.error('State is required'); return false; }
      if (!/^\d{6}$/.test(newAddress.pincode)) { toast.error('Enter a valid 6-digit pincode'); return false; }
    }
    if (!freightType) {
      toast.error('Please select a freight option');
      return false;
    }
    return true;
  }

  async function handlePay() {
    if (!validateForm()) return;
    if (!razorpayReady) {
      toast.error('Payment gateway is loading. Please try again.');
      return;
    }

    // Tier verification gate
    if (!tierVerified) {
      if (total >= 10_00_000) { setTierModal(3); return; }
      if (total >= 1_00_000) { setTierModal(2); return; }
    }

    setPlacing(true);

    try {
      // Build delivery address
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

      // Place order
      const orderRes = await ordersApi.placeOrder({
        listing_id: listingId,
        quantity,
        delivery_address: deliveryAddress,
        freight_type: freightType,
      });
      const orderPayload = (orderRes.data as unknown as { data?: { orderId: string; order_number: string } } | { orderId: string; order_number: string });
      const orderId = (orderPayload as { data?: { orderId: string } })?.data?.orderId
        ?? (orderPayload as { orderId?: string })?.orderId
        ?? '';

      // Initiate payment
      const totalPaisa = Math.round(total * 100);
      const payRes = await paymentsApi.initiatePayment(orderId, totalPaisa);
      const payPayload = (payRes.data as unknown as { data?: { razorpay_order_id: string; razorpay_key: string; amount: number } } | { razorpay_order_id: string; razorpay_key: string; amount: number });
      const rzpData = (payPayload as { data?: { razorpay_order_id: string; razorpay_key: string; amount: number } })?.data
        ?? payPayload as { razorpay_order_id: string; razorpay_key: string; amount: number };

      const user = getUser();

      // Open Razorpay
      const rzp = new (window as unknown as { Razorpay: new (opts: Record<string, unknown>) => { open(): void } }).Razorpay({
        key: rzpData.razorpay_key,
        amount: rzpData.amount,
        order_id: rzpData.razorpay_order_id,
        name: 'NirmalMandi',
        description: String((listing as Record<string, unknown> | null)?.title ?? 'Inventory Purchase'),
        prefill: {
          name: user?.name ?? '',
          contact: user?.phone ?? '',
        },
        theme: { color: '#4f46e5' },
        handler: () => {
          router.push(`/orders/${orderId}?paid=true`);
        },
        modal: {
          ondismiss: () => {
            setPlacing(false);
          },
        },
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
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      </div>
    );
  }

  if (listingError || !listing) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
          <AlertCircle className="w-12 h-12 text-red-400" />
          <h2 className="text-xl font-semibold text-gray-800">Listing not found</h2>
          <Link href="/listings" className="btn-primary">Browse listings</Link>
        </div>
      </div>
    );
  }

  const l = listing as Record<string, unknown>;

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        onReady={() => setRazorpayReady(true)}
      />
      {tierModal && (
        <TierVerifyModal
          tier={tierModal}
          orderAmount={total}
          onVerified={() => { setTierVerified(true); setTierModal(null); handlePay(); }}
          onClose={() => setTierModal(null)}
        />
      )}
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
          <Link
            href={`/listings/${listingId}`}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-600 font-medium mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to listing
          </Link>

          <h1 className="text-2xl font-bold text-gray-900 mb-6">Checkout</h1>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* LEFT: Order Summary */}
            <div className="space-y-5">
              <div className="card p-5">
                <h2 className="text-base font-semibold text-gray-900 mb-4">Order Summary</h2>

                {/* Listing preview */}
                <div className="flex items-start gap-4 pb-4 mb-4 border-b border-gray-100">
                  <div className="w-16 h-16 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {Array.isArray(l.images) && (l.images as string[]).length > 0 ? (
                      <img src={(l.images as string[])[0]} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-8 h-8 text-primary-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{String(l.title ?? '')}</p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {String(l.seller_business_name ?? l.seller_name ?? 'Seller')}
                    </p>
                    {!!l.condition_grade && (
                      <span className="inline-block text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded mt-1">
                        Grade: {String(l.condition_grade)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-sm text-gray-600 mb-4">
                  <span className="font-medium">{quantity.toLocaleString('en-IN')}</span> {String(l.unit ?? 'unit')}
                  {quantity !== 1 ? 's' : ''} × ₹{pricePerUnit.toLocaleString('en-IN')} each
                </div>

                {/* Amount breakdown */}
                <div className="border border-gray-200 rounded-xl overflow-hidden text-sm">
                  <div className="divide-y divide-gray-100">
                    <div className="flex justify-between px-4 py-3 text-gray-600">
                      <span>Subtotal ({quantity} × ₹{pricePerUnit.toLocaleString('en-IN')})</span>
                      <span>₹{subtotal.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between px-4 py-3 text-gray-600">
                      <span>Platform fee ({PLATFORM_FEE_PCT}%)</span>
                      <span>₹{platformFee.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between px-4 py-3 text-gray-600">
                      <span>GST on fee ({GST_ON_FEE_PCT}%)</span>
                      <span>₹{gstOnFee.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between px-4 py-3 text-gray-600">
                      <span>Freight</span>
                      <span>
                        {loadingFreight
                          ? <span className="text-gray-400">Calculating...</span>
                          : freight === null && !freightType
                            ? <span className="text-gray-400 italic">Select freight option</span>
                            : freight === null && freightType === 'platform_logistics'
                              ? <span className="text-red-400 italic text-xs">Estimate unavailable</span>
                              : freight === 0
                                ? <span className="text-green-600 font-medium">Free</span>
                                : `₹${(freight ?? 0).toLocaleString('en-IN')}`}
                      </span>
                    </div>
                    <div className="flex justify-between px-4 py-3 bg-gray-50 font-bold text-gray-900 text-base">
                      <span>Total</span>
                      <span className="text-primary-600 flex items-center gap-0.5">
                        <IndianRupee className="w-4 h-4" />
                        {total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Escrow info box */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl overflow-hidden">
                <button
                  onClick={handleEscrowToggle}
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                >
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                    <span className="text-sm font-semibold text-indigo-800">Your payment is escrow-protected</span>
                  </div>
                  {escrowCollapsed
                    ? <ChevronDown className="w-4 h-4 text-indigo-500" />
                    : <ChevronUp className="w-4 h-4 text-indigo-500" />}
                </button>
                {!escrowCollapsed && (
                  <div className="px-4 pb-4 text-sm text-indigo-700 leading-relaxed">
                    Funds are held safely in escrow and only released to the seller after you confirm delivery. In case of any dispute, NirmalMandi mediates on your behalf.
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: Checkout Form */}
            <div className="space-y-5">
              {/* Section A: Delivery Address */}
              <div className="card p-5">
                <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary-600" />
                  Delivery Address
                </h2>

                {loadingAddresses ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading addresses...
                  </div>
                ) : (
                  <div className="space-y-3">
                    {addressList.map((addr) => (
                      <label
                        key={addr.id}
                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                          selectedAddressId === addr.id && !showNewAddressForm
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="address"
                          value={addr.id}
                          checked={selectedAddressId === addr.id && !showNewAddressForm}
                          onChange={() => {
                            setSelectedAddressId(addr.id);
                            setShowNewAddressForm(false);
                          }}
                          className="mt-0.5 accent-indigo-600"
                        />
                        <div className="text-sm">
                          <p className="font-medium text-gray-900">{addr.name}</p>
                          <p className="text-gray-600">{addr.address_line1}{addr.address_line2 ? `, ${addr.address_line2}` : ''}</p>
                          <p className="text-gray-600">{addr.city}, {addr.state} — {addr.pincode}</p>
                          <p className="text-gray-500">{addr.phone}</p>
                        </div>
                      </label>
                    ))}

                    {/* Add new address option */}
                    <label
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                        showNewAddressForm
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-dashed border-gray-300 hover:border-primary-400'
                      }`}
                    >
                      <input
                        type="radio"
                        name="address"
                        checked={showNewAddressForm}
                        onChange={() => {
                          setShowNewAddressForm(true);
                          setSelectedAddressId('');
                        }}
                        className="accent-indigo-600"
                      />
                      <div className="flex items-center gap-1.5 text-sm font-medium text-primary-600">
                        <Plus className="w-4 h-4" />
                        Add New Address
                      </div>
                    </label>

                    {/* New address form */}
                    {showNewAddressForm && (
                      <div className="space-y-3 pt-2 pl-6">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
                            <input
                              type="text"
                              value={newAddress.name}
                              onChange={(e) => setNewAddress((p) => ({ ...p, name: e.target.value }))}
                              className="input-field text-sm"
                              placeholder="Raj Kumar"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Phone *</label>
                            <input
                              type="tel"
                              value={newAddress.phone}
                              onChange={(e) => setNewAddress((p) => ({ ...p, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                              className="input-field text-sm"
                              placeholder="9876543210"
                              inputMode="numeric"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Address Line 1 *</label>
                          <input
                            type="text"
                            value={newAddress.address_line1}
                            onChange={(e) => setNewAddress((p) => ({ ...p, address_line1: e.target.value }))}
                            className="input-field text-sm"
                            placeholder="Plot no, Street, Area"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Address Line 2</label>
                          <input
                            type="text"
                            value={newAddress.address_line2}
                            onChange={(e) => setNewAddress((p) => ({ ...p, address_line2: e.target.value }))}
                            className="input-field text-sm"
                            placeholder="Landmark, Building (optional)"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">City *</label>
                            <input
                              type="text"
                              value={newAddress.city}
                              onChange={(e) => setNewAddress((p) => ({ ...p, city: e.target.value }))}
                              className="input-field text-sm"
                              placeholder="Mumbai"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Pincode *</label>
                            <input
                              type="text"
                              value={newAddress.pincode}
                              onChange={(e) => setNewAddress((p) => ({ ...p, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                              className="input-field text-sm"
                              placeholder="400001"
                              inputMode="numeric"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">State *</label>
                          <select
                            value={newAddress.state}
                            onChange={(e) => setNewAddress((p) => ({ ...p, state: e.target.value }))}
                            className="input-field text-sm"
                          >
                            <option value="">Select state</option>
                            {INDIAN_STATES.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>
                        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newAddress.save_for_future}
                            onChange={(e) => setNewAddress((p) => ({ ...p, save_for_future: e.target.checked }))}
                            className="accent-indigo-600"
                          />
                          Save address for future orders
                        </label>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Section B: Freight Options */}
              {(selectedAddressId || showNewAddressForm) && (
                <div className="card p-5">
                  <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Truck className="w-4 h-4 text-primary-600" />
                    Freight Options
                  </h2>
                  <div className="space-y-3">
                    {[
                      {
                        value: 'self_ship' as FreightType,
                        label: 'Seller Self-Ship',
                        subtitle: 'Seller arranges delivery',
                        price: 'Free',
                        eta: '3–7 business days',
                      },
                      {
                        value: 'platform_logistics' as FreightType,
                        label: 'Platform Logistics — Delhivery',
                        subtitle: 'NirmalMandi arranges pickup & delivery',
                        price: loadingFreight
                          ? 'Calculating...'
                          : freightEstimate !== null && freightType === 'platform_logistics'
                            ? `₹${freightEstimate.toLocaleString('en-IN')}`
                            : 'Select to see estimate',
                        eta: '2–4 business days',
                      },
                      {
                        value: 'buyer_pickup' as FreightType,
                        label: 'Buyer Pickup',
                        subtitle: 'You coordinate pickup directly with seller',
                        price: 'Free',
                        eta: 'Coordinate with seller',
                      },
                    ].map((opt) => (
                      <label
                        key={opt.value}
                        className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                          freightType === opt.value
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="freight"
                          value={opt.value}
                          checked={freightType === opt.value}
                          onChange={() => setFreightType(opt.value)}
                          className="mt-0.5 accent-indigo-600"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-900">{opt.label}</span>
                            <span className={`text-sm font-semibold ${opt.price === 'Free' ? 'text-green-600' : 'text-gray-800'}`}>
                              {opt.price}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{opt.subtitle}</p>
                          <p className="text-xs text-gray-400 mt-0.5">Est. {opt.eta}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Section C: Payment */}
              <div className="card p-5">
                <button
                  onClick={handlePay}
                  disabled={placing || !freightType || loadingFreight || (freightType === 'platform_logistics' && freightEstimate === null)}
                  className="w-full py-3.5 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-base rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {placing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      Pay ₹{total.toLocaleString('en-IN', { maximumFractionDigits: 2 })} Securely
                    </>
                  )}
                </button>
                <div className="flex items-center justify-center gap-2 mt-3 text-xs text-gray-400">
                  <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                  <span>UPI · Cards · NEFT · RTGS via Razorpay</span>
                </div>
                <p className="text-center text-xs text-gray-400 mt-2">
                  256-bit SSL encrypted · PCI-DSS compliant
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
