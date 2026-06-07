'use client';

import { useState, useEffect, useCallback } from 'react';
import { Gavel, Wifi, WifiOff, Loader2, AlertCircle, Clock, Users, IndianRupee, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { useAuction } from '@/hooks/useAuction';
import { getUser, isAuthenticated } from '@/lib/auth';

interface AuctionPanelProps {
  listingId: string;
  askingPrice: number;
  reservePrice?: number | null;
  auctionEndsAt?: string | null;
  onLoginRequired: () => void;
}

function useCountdown(endsAt: string | null): string {
  const [label, setLabel] = useState('');

  useEffect(() => {
    function compute() {
      if (!endsAt) { setLabel(''); return; }
      const diff = new Date(endsAt).getTime() - Date.now();
      if (diff <= 0) { setLabel('Auction ended'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (h > 0) setLabel(`${h}h ${m}m ${s}s`);
      else if (m > 0) setLabel(`${m}m ${s}s`);
      else setLabel(`${s}s`);
    }
    compute();
    const id = setInterval(compute, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  return label;
}

export default function AuctionPanel({
  listingId,
  askingPrice,
  reservePrice,
  auctionEndsAt: initialEndsAt,
  onLoginRequired,
}: AuctionPanelProps) {
  const { state, connected, lastError, recentBid, placeBid, clearError } = useAuction(listingId, true);
  const [bidAmount, setBidAmount] = useState('');
  const [placing, setPlacing] = useState(false);

  const endsAt = state.auction_ends_at ?? initialEndsAt;
  const countdown = useCountdown(endsAt ?? null);
  const highestBid = state.highest_bid || askingPrice;
  const minNextBid = highestBid + 1;
  const isEnded = endsAt ? new Date(endsAt).getTime() <= Date.now() : false;
  const isUrgent = endsAt ? new Date(endsAt).getTime() - Date.now() < 5 * 60 * 1000 : false;

  // Toast on new bid from another user
  useEffect(() => {
    if (!recentBid) return;
    const user = getUser();
    if (!user) return;
    toast.info(`New bid: ₹${recentBid.amount.toLocaleString('en-IN')}`, {
      description: 'Someone placed a bid — increase yours to stay ahead',
      duration: 4000,
    });
  }, [recentBid]);

  // Toast on bid error
  useEffect(() => {
    if (!lastError) return;
    toast.error(lastError);
    clearError();
  }, [lastError, clearError]);

  async function handlePlaceBid() {
    if (!isAuthenticated()) { onLoginRequired(); return; }
    const amount = parseFloat(bidAmount);
    if (!amount || amount < minNextBid) {
      toast.error(`Minimum bid is ₹${minNextBid.toLocaleString('en-IN')}`);
      return;
    }
    if (isEnded) { toast.error('Auction has ended'); return; }

    setPlacing(true);
    const user = getUser();
    const ok = placeBid(amount, user?.id ?? '');
    if (ok) {
      toast.success(`Bid of ₹${amount.toLocaleString('en-IN')} placed!`);
      setBidAmount('');
    }
    // Give WS time to respond
    setTimeout(() => setPlacing(false), 1500);
  }

  return (
    <div className="nm-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gavel className="w-5 h-5 text-nm-primary" />
          <h2 className="text-base font-bold text-nm-text dark:text-nm-text-dark">Live Auction</h2>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-medium">
          {connected
            ? <><Wifi className="w-3.5 h-3.5 text-nm-success" /><span className="text-nm-success">Live</span></>
            : <><WifiOff className="w-3.5 h-3.5 text-nm-text-muted" /><span className="text-nm-text-muted">Connecting...</span></>
          }
        </div>
      </div>

      {/* Countdown */}
      {endsAt && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold ${
          isEnded
            ? 'bg-gray-100 dark:bg-gray-800 text-nm-text-muted'
            : isUrgent
              ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400'
              : 'bg-nm-primary-pale text-nm-primary-dark'
        }`}>
          <Clock className="w-4 h-4 flex-shrink-0" />
          <span>{isEnded ? 'Auction Ended' : `Ends in ${countdown}`}</span>
          {state.extended && !isEnded && (
            <span className="ml-auto text-xs font-medium bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Extended</span>
          )}
        </div>
      )}

      {/* Bid stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-nm-bg dark:bg-nm-surface-dark rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-nm-text-muted dark:text-nm-text-dark-muted text-xs mb-1">
            <TrendingUp className="w-3.5 h-3.5" />
            Current Bid
          </div>
          <p className="text-xl font-bold text-nm-text dark:text-nm-text-dark flex items-center">
            <IndianRupee className="w-4 h-4" />
            {highestBid.toLocaleString('en-IN')}
          </p>
          {reservePrice && highestBid < reservePrice && (
            <p className="text-xs text-nm-warning mt-0.5">Reserve not met</p>
          )}
        </div>
        <div className="bg-nm-bg dark:bg-nm-surface-dark rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-nm-text-muted dark:text-nm-text-dark-muted text-xs mb-1">
            <Users className="w-3.5 h-3.5" />
            Bidders
          </div>
          <p className="text-xl font-bold text-nm-text dark:text-nm-text-dark">
            {state.bidder_count}
          </p>
          <p className="text-xs text-nm-text-muted mt-0.5">active</p>
        </div>
      </div>

      {/* Bid input */}
      {!isEnded ? (
        <div className="space-y-2">
          <div className="relative">
            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nm-text-muted" />
            <input
              type="number"
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
              placeholder={`Min ₹${minNextBid.toLocaleString('en-IN')}`}
              className="nm-input pl-8 text-base font-semibold"
              min={minNextBid}
              step={1}
              disabled={placing}
            />
          </div>

          {/* Quick bid buttons */}
          <div className="flex gap-2">
            {[minNextBid, minNextBid + Math.round(minNextBid * 0.05), minNextBid + Math.round(minNextBid * 0.1)].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setBidAmount(amt.toString())}
                className="flex-1 text-xs font-medium py-1.5 rounded-lg border border-nm-border dark:border-nm-border-dark hover:border-nm-primary hover:text-nm-primary transition-colors text-nm-text-muted dark:text-nm-text-dark-muted"
              >
                ₹{amt.toLocaleString('en-IN')}
              </button>
            ))}
          </div>

          <button
            onClick={handlePlaceBid}
            disabled={placing || !bidAmount}
            className="nm-btn-primary w-full py-3 text-base font-bold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {placing
              ? <><Loader2 className="w-4 h-4 animate-spin" />Placing bid...</>
              : <><Gavel className="w-4 h-4" />Place Bid</>
            }
          </button>

          <p className="text-xs text-center text-nm-text-muted dark:text-nm-text-dark-muted">
            Bids are binding. Winning bidder proceeds to escrow checkout.
          </p>
        </div>
      ) : (
        <div className="text-center py-4">
          <Gavel className="w-10 h-10 text-nm-text-muted mx-auto mb-2" />
          <p className="font-semibold text-nm-text dark:text-nm-text-dark">Auction Closed</p>
          <p className="text-sm text-nm-text-muted mt-0.5">
            Final price: ₹{highestBid.toLocaleString('en-IN')}
          </p>
        </div>
      )}
    </div>
  );
}
