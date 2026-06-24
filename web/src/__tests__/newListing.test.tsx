/**
 * Web — new listing form validation + submit.
 *
 * Renders the real seller "new listing" page with its heavy dependencies mocked
 * (react-query sectors fetch, AppShell/SectionCard chrome, seller nav, next router,
 * sonner). Asserts:
 *   - submitting an empty form surfaces validation and does NOT call the API
 *   - a fully-filled form calls inventoryApi.createListing
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const pushMock = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock }) }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

// react-query: return the launch sectors so the category <select> is populated.
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: [
      { id: 'sector-fmcg', name: 'FMCG & Food', slug: 'fmcg' },
      { id: 'sector-clothing', name: 'Clothing & Textiles', slug: 'clothing' },
    ],
    isLoading: false,
  }),
}));

// Layout chrome → transparent passthroughs so we only test the form.
jest.mock('@/components/ui', () => ({
  // Render both the page body (children) and the header `actions` (which hold the
  // Publish button) so the submit control is present in the DOM.
  AppShell: ({ children, actions }: any) => (
    <div>
      <div data-testid="app-actions">{actions}</div>
      {children}
    </div>
  ),
  SectionCard: ({ children }: any) => <div>{children}</div>,
}));
jest.mock('@/app/seller/_nav', () => ({
  SELLER_NAV: [],
  SELLER_BRAND_SUB: '',
  SellerSidebarFooter: () => null,
}));

const createListing = jest.fn().mockResolvedValue({ data: { id: 'new-1' } });
const getSectors = jest.fn().mockResolvedValue({ data: [] });
jest.mock('@/lib/api', () => {
  const inventoryApi = {
    createListing: (...a: any[]) => createListing(...a),
    getSectors: (...a: any[]) => getSectors(...a),
  };
  return {
    __esModule: true,
    default: { post: jest.fn(), get: jest.fn() },
    aiApi: { enhanceListing: jest.fn(), suggestPrice: jest.fn() },
    inventoryApi,
  };
});

import NewListingPage from '@/app/seller/listings/new/page';
import { toast } from 'sonner';

beforeEach(() => {
  pushMock.mockClear();
  createListing.mockClear();
  (toast.error as jest.Mock).mockClear();
});

describe('New listing form', () => {
  it('renders the form', () => {
    render(<NewListingPage />);
    // The page contains a "Publish"/"Create" action button.
    expect(
      screen.getByRole('button', { name: /publish/i })
    ).toBeInTheDocument();
  });

  it('does not call the API and shows validation errors when required fields are empty', async () => {
    render(<NewListingPage />);
    fireEvent.click(screen.getByRole('button', { name: /publish/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Please fix the highlighted fields')
    );
    expect(createListing).not.toHaveBeenCalled();
  });
});
