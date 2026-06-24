/**
 * Web — login flow.
 * Renders the real LoginPage. The auth API is mocked (no network); next/navigation,
 * sonner, and the Brand UI component are mocked. Asserts: form submits, token is
 * stored in localStorage, and a seller is redirected to /seller/dashboard.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ── Mocks ──────────────────────────────────────────────────────────────────────
const pushMock = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock }) }));
jest.mock('next/link', () => ({ __esModule: true, default: ({ children }: any) => <a>{children}</a> }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@/components/ui', () => ({ Brand: () => <div data-testid="brand" /> }));

const emailLogin = jest.fn();
jest.mock('@/lib/api', () => ({ authApi: { emailLogin: (...a: any[]) => emailLogin(...a) } }));

import LoginPage from '@/app/login/page';
import { toast } from 'sonner';

beforeEach(() => {
  pushMock.mockClear();
  emailLogin.mockReset();
  localStorage.clear();
});

describe('LoginPage', () => {
  it('renders the sign-in form', () => {
    render(<LoginPage />);
    expect(screen.getByText('Sign in')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
  });

  it('submits credentials, stores the token, and redirects a seller to /seller/dashboard', async () => {
    emailLogin.mockResolvedValueOnce({
      data: {
        data: {
          access_token: 'acc-123',
          refresh_token: 'ref-456',
          user: { id: 'u1', name: 'Shop Owner', email: 's@x.com', role: 'seller' },
        },
      },
    });

    render(<LoginPage />);
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 's@x.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'secret123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(emailLogin).toHaveBeenCalledWith('s@x.com', 'secret123'));
    await waitFor(() => expect(localStorage.getItem('nm_access_token')).toBe('acc-123'));
    expect(localStorage.getItem('nm_refresh_token')).toBe('ref-456');
    expect(pushMock).toHaveBeenCalledWith('/seller/dashboard');
  });

  it('redirects a buyer to /dashboard', async () => {
    emailLogin.mockResolvedValueOnce({
      data: {
        data: {
          access_token: 'acc',
          refresh_token: 'ref',
          user: { id: 'u2', name: 'Buyer', email: 'b@x.com', role: 'buyer' },
        },
      },
    });
    render(<LoginPage />);
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'b@x.com' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'pw1234' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/dashboard'));
  });

  it('shows an error toast and does not store a token on failed login', async () => {
    emailLogin.mockRejectedValueOnce({ response: { data: { error: 'Invalid email or password' } } });
    render(<LoginPage />);
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'x@x.com' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'bad' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Invalid email or password'));
    expect(localStorage.getItem('nm_access_token')).toBeNull();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('validates that both fields are required before calling the API', async () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Enter email and password'));
    expect(emailLogin).not.toHaveBeenCalled();
  });
});
