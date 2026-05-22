'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Package, MapPin, Tag, IndianRupee, ShoppingCart,
  CheckCircle, AlertCircle, Loader2, Calculator
} from 'lucide-react';
import { toast } from 'sonner';
import Header from '@/components/Header';
import { inventoryApi, ordersApi } from '@/lib/api';
import { getUser, isAuthenticated } from '@/lib/auth';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu & Kashmir', 'Ladakh',
];

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [quantity, setQuantity] = useState(1);
  const [buyerState, setBuyerState] = useState(getUser()?.state ?? '');
  const [placing, setPlacing] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderId, setOrderId] = useState('');

  const { data: listing, isLoading, isError } = useQuery({
    queryKey: ['listing', id],
    queryFn: () => inventoryApi.getListing(id),
    // API returns { success, data: {...listing} }
    select: (res) => (res.data as unknown as { data: Record<string, unknown> })?.data ?? null,
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      </div>
    );
  }

  if (isError || !listing) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
          <AlertCircle className="w-12 h-12 text-red-400" />
          <h2 className="text-xl font-semibold text-gray-800">Listing not found</h2>
          <p className="text-gray-500 text-sm">This listing may have been removed or does not exist.</p>
          <Link href="/listings" className="btn-primary">Browse all listings</Link>
        </div>
      </div>
    );
  }

  // Normalize field names — DB uses asking_price / available_quantity
  const l = listing as Record<string, unknown>;
  const pricePerUnit = Number(l.asking_price ?? l.price_per_unit ?? 0);
  const availableQty = Number(l.available_quantity ?? l.quantity ?? 0);
  const sectorName = String(l.sector_name ?? l.sector ?? '—');
  const sellerLocation = [l.city ?? l.seller_city, l.state ?? l.seller_state].filter(Boolean).join(', ') || '—';
  const listingTitle = String(l.title ?? '');
  const listingDesc = l.description ? String(l.description) : null;
  const listingUnit = String(l.unit ?? 'unit');
  const listingStatus = String(l.status ?? 'unknown');

  const baseAmount = pricePerUnit * quantity;
  const gstRate = Number(l.gst_rate ?? 18);
  const gstAmount = (baseAmount * gstRate) / 100;
  const totalAmount = baseAmount + gstAmount;

  async function handlePlaceOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!isAuthenticated()) {
      toast.error('Please login to place an order');
      router.push('/login');
      return;
    }
    if (!buyerState) {
      toast.error('Please select your state');
      return;
    }
    if (quantity < 1 || quantity > availableQty) {
      toast.error(`Quantity must be between 1 and ${availableQty}`);
      return;
    }
    setPlacing(true);
    try {
      const res = await ordersApi.placeOrder({
        listing_id: String(l.id),
        quantity,
        buyer_state: buyerState,
      });
      const payload = (res.data as unknown as { data: { order_number?: string; order_id?: string } })?.data;
      setOrderId(payload?.order_number ?? payload?.order_id ?? String(l.id));
      setOrderSuccess(true);
      toast.success('Order placed successfully!');
    } catch {
      toast.error('Failed to place order. Please try again.');
    } finally {
      setPlacing(false);
    }
  }

  if (orderSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="card p-10 max-w-md w-full">
            <CheckCircle className="w-16 h-16 text-accent-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Order Placed!</h2>
            <p className="text-gray-500 text-sm mb-1">Your order has been submitted successfully.</p>
            {orderId && (
              <p className="text-sm font-medium text-gray-700 mb-6">
                Order ID: <span className="text-primary-600 font-bold">{orderId}</span>
              </p>
            )}
            <div className="space-y-2">
              <Link href="/dashboard" className="btn-primary block w-full text-center">
                View My Orders
              </Link>
              <Link href="/listings" className="btn-secondary block w-full text-center">
                Continue Browsing
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Back */}
        <Link
          href="/listings"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-600 font-medium mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to listings
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Listing details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Image area */}
            <div className="card overflow-hidden">
              <div className="bg-gradient-to-br from-primary-50 to-primary-100 h-64 flex items-center justify-center">
                <Package className="w-20 h-20 text-primary-300" />
              </div>
            </div>

            {/* Info */}
            <div className="card p-6">
              <div className="flex flex-wrap items-start gap-3 mb-4">
                <span className="badge bg-primary-50 text-primary-700">
                  <Tag className="w-3 h-3 mr-1" />
                  {sectorName}
                </span>
                <span className={`badge ${listingStatus === 'live' || listingStatus === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {listingStatus}
                </span>
              </div>

              <h1 className="text-2xl font-bold text-gray-900 mb-2">{listingTitle}</h1>

              <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-4">
                <MapPin className="w-4 h-4 flex-shrink-0" />
                {sellerLocation}
              </div>

              {listingDesc && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Description</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{listingDesc}</p>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-100">
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Price per {listingUnit}</p>
                  <p className="flex items-center text-xl font-bold text-gray-900">
                    <IndianRupee className="w-4 h-4" />
                    {pricePerUnit.toLocaleString('en-IN')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Available Quantity</p>
                  <p className="text-xl font-bold text-accent-600">
                    {availableQty.toLocaleString('en-IN')} {listingUnit}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">GST Rate</p>
                  <p className="text-xl font-bold text-gray-900">{gstRate}%</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Order form */}
          <div className="lg:col-span-1">
            <div className="card p-6 sticky top-24">
              <div className="flex items-center gap-2 mb-5">
                <ShoppingCart className="w-5 h-5 text-primary-600" />
                <h2 className="text-lg font-bold text-gray-900">Place Order</h2>
              </div>

              {!isAuthenticated() ? (
                <div className="text-center py-4">
                  <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600 mb-4">Login required to place orders</p>
                  <Link href="/login" className="btn-primary block w-full text-center">
                    Login to Order
                  </Link>
                </div>
              ) : (
                <form onSubmit={handlePlaceOrder} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Quantity ({listingUnit})
                    </label>
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, Math.min(availableQty, Number(e.target.value))))}
                      min={1}
                      max={availableQty}
                      className="input-field"
                      required
                    />
                    <p className="text-xs text-gray-400 mt-0.5">
                      Max: {availableQty.toLocaleString('en-IN')} {listingUnit}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Delivery State
                    </label>
                    <select
                      value={buyerState}
                      onChange={(e) => setBuyerState(e.target.value)}
                      className="input-field"
                      required
                    >
                      <option value="">Select state</option>
                      {INDIAN_STATES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  {/* Price breakdown */}
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-2 text-sm">
                    <div className="flex items-center gap-1.5 text-gray-600 font-medium mb-2">
                      <Calculator className="w-4 h-4" />
                      Price Breakdown
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Base ({quantity} × ₹{pricePerUnit.toLocaleString('en-IN')})</span>
                      <span>₹{baseAmount.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>GST ({gstRate}%)</span>
                      <span>₹{gstAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between font-bold text-gray-900 border-t border-gray-300 pt-2 mt-1">
                      <span>Total</span>
                      <span className="text-primary-600">₹{totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={placing || (listingStatus !== 'live' && listingStatus !== 'active')}
                    className="btn-accent w-full flex items-center justify-center gap-2 py-2.5"
                  >
                    {placing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
                    {placing ? 'Placing Order...' : (listingStatus !== 'live' && listingStatus !== 'active') ? 'Not Available' : 'Place Order'}
                  </button>

                  <p className="text-xs text-gray-400 text-center">
                    GST invoice will be provided with your order
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
