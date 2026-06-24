/**
 * Admin — login page.
 * Asserts the admin console rejects non-admin roles, stores the token only for
 * admins, and surfaces server errors. The api client is mocked (no network).
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const post = jest.fn();
jest.mock('@/lib/api', () => ({ __esModule: true, default: { post: (...a: any[]) => post(...a) } }));

import AdminLoginPage from '@/app/login/page';

// Make window.location.href assignable in jsdom.
beforeAll(() => {
  delete (window as any).location;
  (window as any).location = { href: '' };
});

beforeEach(() => {
  post.mockReset();
  localStorage.clear();
  (window as any).location.href = '';
});

function fillAndSubmit(email: string, password: string) {
  fireEvent.change(screen.getByPlaceholderText(/marketing\.amalthea|admin email/i), {
    target: { value: email },
  });
  fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
}

describe('AdminLoginPage', () => {
  it('rejects a non-admin role and does not store a token', async () => {
    post.mockResolvedValueOnce({
      data: { data: { access_token: 'tok', user: { id: 'u1', role: 'seller', name: 'Seller' } } },
    });
    render(<AdminLoginPage />);
    fillAndSubmit('seller@example.com', 'secret123');

    await waitFor(() =>
      expect(screen.getByText(/admin accounts only/i)).toBeInTheDocument()
    );
    expect(localStorage.getItem('nm_admin_token')).toBeNull();
    expect(window.location.href).toBe('');
  });

  it('logs in an admin: stores token + user and redirects to /', async () => {
    post.mockResolvedValueOnce({
      data: { data: { access_token: 'admin-tok', user: { id: 'a1', role: 'admin', name: 'Admin' } } },
    });
    render(<AdminLoginPage />);
    fillAndSubmit('admin@example.com', 'secret123');

    await waitFor(() => expect(localStorage.getItem('nm_admin_token')).toBe('admin-tok'));
    expect(JSON.parse(localStorage.getItem('nm_admin_user')!).role).toBe('admin');
    expect(window.location.href).toBe('/');
  });

  it('shows a server error message on failed login', async () => {
    post.mockRejectedValueOnce({ response: { data: { error: 'Invalid email or password' } } });
    render(<AdminLoginPage />);
    fillAndSubmit('admin@example.com', 'wrong');
    await waitFor(() =>
      expect(screen.getByText('Invalid email or password')).toBeInTheDocument()
    );
    expect(localStorage.getItem('nm_admin_token')).toBeNull();
  });

  it('requires both email and password before calling the API', async () => {
    render(<AdminLoginPage />);
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() =>
      expect(screen.getByText(/email and password required/i)).toBeInTheDocument()
    );
    expect(post).not.toHaveBeenCalled();
  });
});
