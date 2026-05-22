import { Client } from '@elastic/elasticsearch';
import { logger } from '@nirmalmandi/shared';

let esClient: Client;

export function getEs(): Client {
  if (!esClient) {
    esClient = new Client({ node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200' });
  }
  return esClient;
}

const LISTINGS_INDEX = 'nm_listings';

export async function ensureListingsIndex(): Promise<void> {
  const es = getEs();
  const exists = await es.indices.exists({ index: LISTINGS_INDEX });
  if (!exists) {
    await es.indices.create({
      index: LISTINGS_INDEX,
      body: {
        settings: { number_of_shards: 2, number_of_replicas: 1 },
        mappings: {
          properties: {
            id: { type: 'keyword' },
            seller_id: { type: 'keyword' },
            sector_id: { type: 'keyword' },
            sector_slug: { type: 'keyword' },
            title: { type: 'text', analyzer: 'standard' },
            description: { type: 'text', analyzer: 'standard' },
            dead_stock_type: { type: 'keyword' },
            condition_grade: { type: 'keyword' },
            lot_type: { type: 'keyword' },
            price_type: { type: 'keyword' },
            asking_price: { type: 'double' },
            mrp: { type: 'double' },
            available_quantity: { type: 'integer' },
            moq: { type: 'integer' },
            state: { type: 'keyword' },
            city: { type: 'keyword' },
            urgency_score: { type: 'double' },
            is_featured: { type: 'boolean' },
            is_urgent_badge: { type: 'boolean' },
            status: { type: 'keyword' },
            expiry_date: { type: 'date' },
            auction_ends_at: { type: 'date' },
            seller_tier: { type: 'keyword' },
            images: { type: 'keyword' },
            created_at: { type: 'date' },
          },
        },
      },
    });
    logger.info('Elasticsearch listings index created');
  }
}

export async function syncListingToElasticsearch(listing: Record<string, unknown>): Promise<void> {
  const es = getEs();
  await es.index({
    index: LISTINGS_INDEX,
    id: listing.id as string,
    document: {
      id: listing.id,
      seller_id: listing.seller_id,
      sector_id: listing.sector_id,
      title: listing.title,
      description: listing.description,
      dead_stock_type: listing.dead_stock_type,
      condition_grade: listing.condition_grade,
      lot_type: listing.lot_type,
      price_type: listing.price_type,
      asking_price: listing.asking_price,
      mrp: listing.mrp,
      available_quantity: listing.available_quantity,
      moq: listing.moq,
      state: listing.state,
      city: listing.city,
      urgency_score: listing.urgency_score,
      is_featured: listing.is_featured,
      is_urgent_badge: listing.is_urgent_badge,
      status: listing.status,
      expiry_date: listing.expiry_date,
      auction_ends_at: listing.auction_ends_at,
      images: listing.images,
      created_at: listing.created_at,
    },
  });
}

export async function deleteListingFromEs(listingId: string): Promise<void> {
  const es = getEs();
  try {
    await es.delete({ index: LISTINGS_INDEX, id: listingId });
  } catch {
    logger.warn('Could not delete listing from ES', { listingId });
  }
}
