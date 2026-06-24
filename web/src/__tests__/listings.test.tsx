/**
 * Web — listings data integration + card rendering.
 *
 * Uses MSW to mock the `/api/inventory/listings` endpoint and drives the real
 * `inventoryApi` client (the same client the /listings page uses). A small
 * presentational list renders the returned listings, asserting cards appear.
 *
 * This isolates the API → render contract without mounting the full filter-heavy
 * page (which depends on many UI sub-components and next/navigation search params).
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { inventoryApi, type Listing } from '@/lib/api';

const sampleListings: Partial<Listing>[] = [
  { id: 'l1', title: 'Surplus Cotton T-Shirts — 1000 pcs', asking_price: 120, city: 'Surat', state: 'Gujarat' },
  { id: 'l2', title: 'Excess FMCG Snacks Lot', asking_price: 80, city: 'Mumbai', state: 'Maharashtra' },
];

const server = setupServer(
  http.get('*/api/inventory/listings', () =>
    HttpResponse.json({ data: sampleListings, total: 2, page: 1, limit: 12 })
  )
);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// A minimal card list that consumes the same API the /listings page uses.
function ListingGrid() {
  const [items, setItems] = React.useState<Partial<Listing>[]>([]);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    inventoryApi
      .getListings({ page: 1, limit: 12 })
      .then((res) => setItems((res.data as any).data ?? []))
      .finally(() => setLoading(false));
  }, []);
  if (loading) return <div>Loading…</div>;
  return (
    <ul>
      {items.map((l) => (
        <li key={l.id} data-testid="listing-card">
          <span>{l.title}</span>
          <span>₹{l.asking_price}</span>
          <span>{l.city}</span>
        </li>
      ))}
    </ul>
  );
}

describe('listings page data → cards', () => {
  it('renders a card for each listing returned by the API', async () => {
    render(<ListingGrid />);
    await waitFor(() => expect(screen.getAllByTestId('listing-card')).toHaveLength(2));
    expect(screen.getByText('Surplus Cotton T-Shirts — 1000 pcs')).toBeInTheDocument();
    expect(screen.getByText('Excess FMCG Snacks Lot')).toBeInTheDocument();
    expect(screen.getByText('Surat')).toBeInTheDocument();
  });

  it('renders no cards when the API returns an empty list', async () => {
    server.use(
      http.get('*/api/inventory/listings', () =>
        HttpResponse.json({ data: [], total: 0, page: 1, limit: 12 })
      )
    );
    render(<ListingGrid />);
    await waitFor(() => expect(screen.queryByText('Loading…')).not.toBeInTheDocument());
    expect(screen.queryAllByTestId('listing-card')).toHaveLength(0);
  });

  it('inventoryApi.getListings calls the correct endpoint with params', async () => {
    let receivedUrl = '';
    server.use(
      http.get('*/api/inventory/listings', ({ request }) => {
        receivedUrl = request.url;
        return HttpResponse.json({ data: sampleListings, total: 2, page: 1, limit: 12 });
      })
    );
    const res = await inventoryApi.getListings({ sector: 'fmcg', min_price: 50, page: 2 });
    expect((res.data as any).total).toBe(2);
    expect(receivedUrl).toContain('sector=fmcg');
    expect(receivedUrl).toContain('min_price=50');
    expect(receivedUrl).toContain('page=2');
  });
});
