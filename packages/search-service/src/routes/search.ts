import { Router, Request, Response } from 'express';
import { Client } from '@elastic/elasticsearch';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import {
  authenticate,
  query, queryOne,
  successResponse, errorResponse,
  logger,
} from '@nirmalmandi/shared';

export const searchRouter = Router();

const LISTINGS_INDEX = 'nm_listings';

let esClient: Client;
function getEs(): Client {
  if (!esClient) {
    esClient = new Client({ node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200' });
  }
  return esClient;
}

// ── Query schema ────────────────────────────────────────────────
const searchQuerySchema = z.object({
  q: z.string().optional().default(''),
  sector: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  min_price: z.coerce.number().positive().optional(),
  max_price: z.coerce.number().positive().optional(),
  condition_grade: z.enum(['A', 'B', 'C', 'D']).optional(),
  price_type: z.enum(['fixed', 'offer', 'auction', 'flash']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ── GET /search ─────────────────────────────────────────────────
searchRouter.get('/', async (req: Request, res: Response) => {
  const parsed = searchQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json(errorResponse(parsed.error.errors[0].message, 'VALIDATION_ERROR'));
    return;
  }

  const {
    q, sector, state, city,
    min_price, max_price, condition_grade, price_type,
    page, limit,
  } = parsed.data;

  const from = (page - 1) * limit;

  // Build filter array — status must always be 'live'
  const filters: object[] = [
    { term: { status: 'live' } },
  ];

  if (sector) filters.push({ term: { sector_slug: sector } });
  if (state) filters.push({ term: { state } });
  if (city) filters.push({ term: { city } });
  if (condition_grade) filters.push({ term: { condition_grade } });
  if (price_type) filters.push({ term: { price_type } });

  if (min_price !== undefined || max_price !== undefined) {
    const range: Record<string, number> = {};
    if (min_price !== undefined) range.gte = min_price;
    if (max_price !== undefined) range.lte = max_price;
    filters.push({ range: { asking_price: range } });
  }

  // Bool query: text search + filters + function scoring
  const boolQuery: Record<string, unknown> = {
    filter: filters,
  };

  if (q && q.trim().length > 0) {
    boolQuery.must = {
      multi_match: {
        query: q.trim(),
        fields: ['title^3', 'description'],
        type: 'best_fields',
        fuzziness: 'AUTO',
      },
    };
  } else {
    boolQuery.must = { match_all: {} };
  }

  const esQuery = {
    function_score: {
      query: { bool: boolQuery },
      functions: [
        {
          field_value_factor: {
            field: 'urgency_score',
            factor: 2,
            modifier: 'none',
            missing: 0,
          },
        },
        {
          filter: { term: { is_featured: true } },
          weight: 1.5,
        },
        {
          filter: { term: { is_urgent_badge: true } },
          weight: 1,
        },
      ],
      score_mode: 'sum',
      boost_mode: 'multiply',
    },
  };

  try {
    const esResponse = await getEs().search({
      index: LISTINGS_INDEX,
      from,
      size: limit,
      body: {
        query: esQuery,
        _source: true,
      },
    });

    const total =
      typeof esResponse.hits.total === 'object'
        ? esResponse.hits.total.value
        : esResponse.hits.total ?? 0;

    const hits = esResponse.hits.hits.map((h) => ({
      ...h._source,
      _score: h._score,
    }));

    res.json(successResponse({ hits, total, page, limit }));
  } catch (err) {
    logger.error('Elasticsearch search error', { error: (err as Error).message });
    res.status(500).json(errorResponse('Search failed', 'SEARCH_ERROR'));
  }
});

// ── GET /search/autocomplete ─────────────────────────────────────
searchRouter.get('/autocomplete', async (req: Request, res: Response) => {
  const q = String(req.query.q ?? '').trim();
  if (!q) {
    res.json(successResponse({ suggestions: [] }));
    return;
  }

  try {
    const esResponse = await getEs().search({
      index: LISTINGS_INDEX,
      size: 8,
      body: {
        query: {
          bool: {
            must: {
              match_phrase_prefix: {
                title: { query: q, max_expansions: 20 },
              },
            },
            filter: [{ term: { status: 'live' } }],
          },
        },
        _source: ['id', 'title', 'asking_price', 'images', 'condition_grade'],
      },
    });

    const suggestions = esResponse.hits.hits.map((h) => h._source);
    res.json(successResponse({ suggestions }));
  } catch (err) {
    logger.error('Autocomplete error', { error: (err as Error).message });
    res.status(500).json(errorResponse('Autocomplete failed', 'SEARCH_ERROR'));
  }
});

// ── GET /search/deal-feed ────────────────────────────────────────
searchRouter.get('/deal-feed', async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10)));
  const buyer_id = String(req.query.buyer_id ?? '').trim() || undefined;
  const from = (page - 1) * limit;

  // Base filters
  const filters: object[] = [{ term: { status: 'live' } }];

  // Personalization: if buyer_id provided, fetch their sector interests
  if (buyer_id) {
    try {
      const buyer = await queryOne<{ sector_interests: string[] }>(
        'SELECT sector_interests FROM buyer_profiles WHERE id = $1',
        [buyer_id]
      );
      if (buyer?.sector_interests?.length) {
        filters.push({ terms: { sector_slug: buyer.sector_interests } });
      }
    } catch (err) {
      // non-fatal — serve un-personalized feed
      logger.warn('Failed to fetch buyer sector_interests for deal-feed', { buyer_id, error: (err as Error).message });
    }
  }

  try {
    const esResponse = await getEs().search({
      index: LISTINGS_INDEX,
      from,
      size: limit,
      body: {
        query: {
          function_score: {
            query: { bool: { filter: filters, must: { match_all: {} } } },
            functions: [
              {
                field_value_factor: {
                  field: 'urgency_score',
                  factor: 2,
                  modifier: 'none',
                  missing: 0,
                },
              },
              {
                filter: { term: { is_featured: true } },
                weight: 1.5,
              },
              {
                filter: { term: { is_urgent_badge: true } },
                weight: 1,
              },
            ],
            score_mode: 'sum',
            boost_mode: 'multiply',
          },
        },
        sort: [
          { urgency_score: { order: 'desc', missing: 0 } },
          { is_featured: { order: 'desc' } },
          '_score',
        ],
        _source: true,
      },
    });

    const total =
      typeof esResponse.hits.total === 'object'
        ? esResponse.hits.total.value
        : esResponse.hits.total ?? 0;

    const hits = esResponse.hits.hits.map((h) => h._source);

    res.json(successResponse({ hits, total, page, limit, personalized: !!buyer_id }));
  } catch (err) {
    logger.error('Deal-feed error', { error: (err as Error).message });
    res.status(500).json(errorResponse('Deal feed failed', 'SEARCH_ERROR'));
  }
});

// ── POST /search/saved — save a search ──────────────────────────
const savedSearchSchema = z.object({
  name: z.string().min(1).max(100),
  filters: z.record(z.unknown()),
  notify_new_results: z.boolean().default(false),
});

searchRouter.post(
  '/saved',
  authenticate,
  async (req: Request, res: Response) => {
    const parsed = savedSearchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(errorResponse(parsed.error.errors[0].message, 'VALIDATION_ERROR'));
      return;
    }

    const { name, filters: searchFilters, notify_new_results } = parsed.data;
    const buyer_id = req.user!.profile_id;

    try {
      const id = uuidv4();
      const [saved] = await query<{ id: string; name: string; created_at: Date }>(
        `INSERT INTO saved_searches (id, buyer_id, name, filters, notify_new_results)
         VALUES ($1, $2, $3, $4::jsonb, $5)
         RETURNING id, name, created_at`,
        [id, buyer_id, name, JSON.stringify(searchFilters), notify_new_results]
      );

      res.status(201).json(successResponse(saved, 'Search saved'));
    } catch (err) {
      logger.error('Save search error', { error: (err as Error).message });
      res.status(500).json(errorResponse('Failed to save search', 'DB_ERROR'));
    }
  }
);
