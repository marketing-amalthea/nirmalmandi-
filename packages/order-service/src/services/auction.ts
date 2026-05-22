/**
 * Auction Service — Real-time bidding via WebSocket
 * WebSocket server runs alongside Express on the same port
 * Bids broadcast instantly to all active bidders
 */
import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { query, queryOne, withTransaction, logger } from '@nirmalmandi/shared';
import { v4 as uuidv4 } from 'uuid';

// Map: listingId → Set of connected WebSocket clients
const auctionRooms = new Map<string, Set<WebSocket>>();

export function initAuctionWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws/auction' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const listingId = url.searchParams.get('listing_id');
    if (!listingId) { ws.close(1008, 'listing_id required'); return; }

    // Join auction room
    if (!auctionRooms.has(listingId)) auctionRooms.set(listingId, new Set());
    auctionRooms.get(listingId)!.add(ws);
    logger.info('Client joined auction room', { listingId, clients: auctionRooms.get(listingId)!.size });

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'place_bid') {
          await handleBid(listingId, msg.buyer_id, msg.amount, ws);
        }
      } catch (e) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    ws.on('close', () => {
      auctionRooms.get(listingId)?.delete(ws);
      if (auctionRooms.get(listingId)?.size === 0) auctionRooms.delete(listingId);
    });

    // Send current auction state
    getCurrentAuctionState(listingId).then(state => {
      ws.send(JSON.stringify({ type: 'auction_state', data: state }));
    });
  });

  return wss;
}

async function handleBid(listingId: string, buyerId: string, amount: number, ws: WebSocket) {
  const listing = await queryOne<{
    asking_price: number; reserve_price: number; auction_ends_at: Date;
    price_type: string; status: string;
  }>(
    'SELECT asking_price, reserve_price, auction_ends_at, price_type, status FROM listings WHERE id = $1',
    [listingId]
  );

  if (!listing || listing.price_type !== 'auction' || listing.status !== 'live') {
    ws.send(JSON.stringify({ type: 'bid_error', message: 'Auction not available' }));
    return;
  }
  if (new Date() > listing.auction_ends_at) {
    ws.send(JSON.stringify({ type: 'bid_error', message: 'Auction has ended' }));
    return;
  }

  // Get current highest bid
  const currentHighest = await queryOne<{ amount: number }>(
    'SELECT MAX(amount) as amount FROM auction_bids WHERE listing_id = $1',
    [listingId]
  );
  const minBid = Math.max(
    listing.asking_price,
    (currentHighest?.amount ?? 0) + 1
  );

  if (amount < minBid) {
    ws.send(JSON.stringify({ type: 'bid_error', message: `Bid must be at least ₹${minBid.toLocaleString('en-IN')}` }));
    return;
  }

  await withTransaction(async (client) => {
    // Mark all previous bids as not winning
    await client.query('UPDATE auction_bids SET is_winning = false WHERE listing_id = $1', [listingId]);
    // Insert new winning bid
    await client.query(
      'INSERT INTO auction_bids (id, listing_id, buyer_id, amount, is_winning) VALUES ($1,$2,$3,$4,true)',
      [uuidv4(), listingId, buyerId, amount]
    );
  });

  // Anti-sniping: extend by 15 min if bid in last 5 min
  const timeLeft = listing.auction_ends_at.getTime() - Date.now();
  if (timeLeft < 5 * 60 * 1000) {
    const newEnd = new Date(Date.now() + 15 * 60 * 1000);
    await query('UPDATE listings SET auction_ends_at = $1 WHERE id = $2', [newEnd, listingId]);
    broadcastToRoom(listingId, {
      type: 'auction_extended',
      new_end_time: newEnd,
      reason: 'Late bid — auction extended by 15 minutes',
    });
  }

  // Broadcast new bid to all room members
  broadcastToRoom(listingId, {
    type: 'bid_placed',
    listing_id: listingId,
    amount,
    buyer_id: buyerId,
    bidder_count: await getBidderCount(listingId),
    auction_ends_at: listing.auction_ends_at,
  });

  // Notify previously winning buyer they've been outbid
  const prev = await queryOne<{ buyer_id: string }>(
    'SELECT buyer_id FROM auction_bids WHERE listing_id = $1 AND is_winning = false ORDER BY amount DESC LIMIT 1',
    [listingId]
  );
  if (prev && prev.buyer_id !== buyerId) {
    notifyOutbid(prev.buyer_id, listingId, amount);
  }

  logger.info('Bid placed', { listingId, buyerId, amount });
}

function broadcastToRoom(listingId: string, message: object) {
  const room = auctionRooms.get(listingId);
  if (!room) return;
  const data = JSON.stringify(message);
  room.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(data);
  });
}

async function getCurrentAuctionState(listingId: string) {
  const [listing, highestBid, bidCount] = await Promise.all([
    queryOne(
      'SELECT id, title, asking_price, reserve_price, auction_ends_at, images FROM listings WHERE id = $1',
      [listingId]
    ),
    queryOne<{ amount: number; buyer_id: string }>(
      'SELECT amount, buyer_id FROM auction_bids WHERE listing_id = $1 AND is_winning = true LIMIT 1',
      [listingId]
    ),
    getBidderCount(listingId),
  ]);
  return { listing, highest_bid: highestBid?.amount ?? 0, bidder_count: bidCount };
}

async function getBidderCount(listingId: string): Promise<number> {
  const result = await queryOne<{ count: string }>(
    'SELECT COUNT(DISTINCT buyer_id) as count FROM auction_bids WHERE listing_id = $1',
    [listingId]
  );
  return parseInt(result?.count ?? '0', 10);
}

async function notifyOutbid(buyerId: string, listingId: string, newBid: number) {
  try {
    const { default: axios } = await import('axios');
    await axios.post(`${process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3006'}/notifications/send`, {
      profile_id: buyerId,
      type: 'outbid',
      title: 'You\'ve been outbid!',
      body: `Someone bid ₹${newBid.toLocaleString('en-IN')} — bid again to win.`,
      channels: ['push', 'in_app'],
    });
  } catch { /* non-critical */ }
}
