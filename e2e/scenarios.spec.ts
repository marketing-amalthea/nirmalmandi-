/**
 * NirmalMandi — End-to-End scenario specs (Playwright).
 *
 * STRUCTURE ONLY. These describe the full cross-service user journeys that the
 * unit/integration suites cover in pieces. They are written against Playwright's
 * `test` API but the steps are intentionally left as `test.fixme(...)` so the file
 * is safe to keep in the repo before Playwright + a seeded staging stack exist.
 *
 * To run for real:
 *   1. npm i -D @playwright/test && npx playwright install
 *   2. Stand up the services + web/admin against a seeded test DB
 *   3. Set BASE_URL_WEB / BASE_URL_ADMIN and replace test.fixme → test
 *
 * Covered journeys:
 *   A. Seller registers → creates listing → listing appears in marketplace
 *   B. Buyer orders → payment captured → escrow held → delivery confirmed → escrow released
 *   C. Buyer raises dispute → escrow frozen → admin resolves → correct party paid
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
import { test, expect } from '@playwright/test';

const WEB = process.env.BASE_URL_WEB ?? 'http://localhost:3010';
const ADMIN = process.env.BASE_URL_ADMIN ?? 'http://localhost:3000';

// ── Scenario A — Seller onboarding → listing visible in marketplace ─────────────
test.describe('A. Seller registers → creates listing → appears in marketplace', () => {
  test.fixme('seller signs up with email + password and lands on the dashboard', async ({ page }) => {
    await page.goto(`${WEB}/seller-register`);
    await page.getByLabel('Business name').fill('Acme Liquidators');
    await page.getByLabel('Email').fill(`seller_${Date.now()}@example.com`);
    await page.getByLabel('Password').fill('secret123');
    await page.getByRole('button', { name: /create|register|continue/i }).click();
    await expect(page).toHaveURL(/\/seller\/dashboard/);
  });

  test.fixme('seller creates a live listing', async ({ page }) => {
    await page.goto(`${WEB}/seller/listings/new`);
    await page.getByLabel('Title').fill('Surplus FMCG Lot — 500 units');
    await page.getByLabel('Category').selectOption({ label: 'FMCG & Food' });
    await page.getByLabel('Total quantity').fill('500');
    await page.getByLabel('Asking price').fill('250');
    await page.getByRole('button', { name: /publish/i }).click();
    await expect(page.getByText(/listing is live/i)).toBeVisible();
  });

  test.fixme('the new listing is discoverable on the public marketplace', async ({ page }) => {
    await page.goto(`${WEB}/listings?search=Surplus%20FMCG`);
    await expect(page.getByText('Surplus FMCG Lot — 500 units')).toBeVisible();
  });
});

// ── Scenario B — Order → payment → escrow → delivery → release ──────────────────
test.describe('B. Buyer order → escrow held → delivery confirmed → escrow released', () => {
  test.fixme('buyer places an order on a live listing', async ({ page }) => {
    await page.goto(`${WEB}/listings`);
    await page.getByTestId('listing-card').first().click();
    await page.getByLabel('Quantity').fill('20');
    await page.getByRole('button', { name: /place order|buy now/i }).click();
    await expect(page.getByText(/order created|payment/i)).toBeVisible();
  });

  test.fixme('payment is captured and escrow moves to held', async ({ page }) => {
    // Razorpay checkout is stubbed in test mode; webhook marks payment.captured.
    await page.getByRole('button', { name: /pay now/i }).click();
    await expect(page.getByText(/payment successful|in escrow|held/i)).toBeVisible();
  });

  test.fixme('buyer confirms delivery → escrow releases net payout to seller', async ({ page }) => {
    await page.goto(`${WEB}/dashboard/orders`);
    await page.getByRole('button', { name: /confirm delivery/i }).first().click();
    await expect(page.getByText(/delivered|payment released/i)).toBeVisible();
    // Seller side: order shows completed and escrow released.
  });
});

// ── Scenario C — Dispute → escrow frozen → admin resolution ─────────────────────
test.describe('C. Buyer raises dispute → escrow frozen → admin resolves → funds routed', () => {
  test.fixme('buyer raises a dispute on a delivered order', async ({ page }) => {
    await page.goto(`${WEB}/dashboard/orders`);
    await page.getByRole('button', { name: /raise dispute/i }).first().click();
    await page.getByLabel('Reason').selectOption('damaged');
    await page.getByLabel('Description').fill('Goods arrived crushed and unusable on delivery.');
    await page.getByRole('button', { name: /submit/i }).click();
    await expect(page.getByText(/dispute raised/i)).toBeVisible();
  });

  test.fixme('escrow is frozen (dispute hold) while the dispute is open', async ({ page }) => {
    await page.goto(`${ADMIN}/transactions`);
    await expect(page.getByText(/disputed|on hold/i).first()).toBeVisible();
  });

  test.fixme('admin resolves in the buyer favour → buyer is refunded', async ({ page }) => {
    await page.goto(`${ADMIN}/disputes`);
    await page.getByTestId('dispute-row').first().click();
    await page.getByRole('button', { name: /resolve/i }).click();
    await page.getByLabel('Outcome').selectOption('refund_buyer');
    await page.getByLabel('Resolution').fill('Damage evidence is conclusive; refunding the buyer.');
    await page.getByRole('button', { name: /confirm resolution/i }).click();
    await expect(page.getByText(/resolved|refund/i)).toBeVisible();
  });

  test.fixme('admin resolves in the seller favour → escrow force-released to seller', async ({ page }) => {
    await page.goto(`${ADMIN}/disputes`);
    await page.getByTestId('dispute-row').first().click();
    await page.getByRole('button', { name: /resolve/i }).click();
    await page.getByLabel('Outcome').selectOption('release_to_seller');
    await page.getByLabel('Resolution').fill('Seller proof of delivery is conclusive; releasing funds.');
    await page.getByRole('button', { name: /confirm resolution/i }).click();
    await expect(page.getByText(/resolved|released/i)).toBeVisible();
  });
});
