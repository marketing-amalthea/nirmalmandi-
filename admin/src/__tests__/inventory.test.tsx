/**
 * Admin — inventory data layer.
 * Drives the real admin `inventoryApi` against MSW. Validates:
 *   - the inventory list loads from /admin/inventory and renders rows
 *   - the "feature" action PATCHes /admin/inventory/:id/feature (correct endpoint)
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { inventoryApi } from '@/lib/api';

const listings = [
  { id: 'L1', title: 'Bulk Sneakers Lot', status: 'live', is_featured: false },
  { id: 'L2', title: 'Surplus Paint Cans', status: 'live', is_featured: false },
];

let featuredCalls: string[] = [];

const server = setupServer(
  http.get('*/api/admin/inventory', () =>
    HttpResponse.json({ data: { rows: listings, total: 2 } })
  ),
  http.patch('*/api/admin/inventory/:id/feature', ({ params }) => {
    featuredCalls.push(params.id as string);
    return HttpResponse.json({ success: true, data: { id: params.id, is_featured: true } });
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  featuredCalls = [];
});
afterAll(() => server.close());

// Minimal admin inventory view that uses the same API the real page uses.
function AdminInventory() {
  const [rows, setRows] = React.useState<any[]>([]);
  React.useEffect(() => {
    inventoryApi.getListings({ page: 1 }).then((res: any) => setRows(res.data.data.rows));
  }, []);
  return (
    <table>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} data-testid="inv-row">
            <td>{r.title}</td>
            <td>
              <button onClick={() => inventoryApi.featureListing(r.id)}>Feature</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

describe('Admin inventory', () => {
  it('loads and renders the listing rows', async () => {
    render(<AdminInventory />);
    await waitFor(() => expect(screen.getAllByTestId('inv-row')).toHaveLength(2));
    expect(screen.getByText('Bulk Sneakers Lot')).toBeInTheDocument();
    expect(screen.getByText('Surplus Paint Cans')).toBeInTheDocument();
  });

  it('the feature action calls PATCH /admin/inventory/:id/feature', async () => {
    render(<AdminInventory />);
    await waitFor(() => expect(screen.getAllByTestId('inv-row')).toHaveLength(2));

    const firstFeatureBtn = screen.getAllByRole('button', { name: 'Feature' })[0];
    fireEvent.click(firstFeatureBtn);

    await waitFor(() => expect(featuredCalls).toContain('L1'));
    expect(featuredCalls).toHaveLength(1);
  });

  it('inventoryApi.getListings targets the /admin/inventory endpoint with params', async () => {
    let url = '';
    server.use(
      http.get('*/api/admin/inventory', ({ request }) => {
        url = request.url;
        return HttpResponse.json({ data: { rows: listings, total: 2 } });
      })
    );
    await inventoryApi.getListings({ status: 'live', page: 3 });
    expect(url).toContain('/admin/inventory');
    expect(url).toContain('status=live');
    expect(url).toContain('page=3');
  });
});
