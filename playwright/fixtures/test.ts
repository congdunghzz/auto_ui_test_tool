import { test as base, expect } from '@playwright/test';
import { CustomersPage } from '../pages/CustomersPage';
import { DashboardPage } from '../pages/DashboardPage';
import { LoginPage } from '../pages/LoginPage';
import { NewOrderPage } from '../pages/NewOrderPage';
import { OrderDetailPage } from '../pages/OrderDetailPage';
import { OrdersPage } from '../pages/OrdersPage';

type Fixtures = {
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
  customersPage: CustomersPage;
  ordersPage: OrdersPage;
  newOrderPage: NewOrderPage;
  orderDetailPage: OrderDetailPage;
  /** Unique, parallel-safe suffix for test data (worker index + time + counter). */
  uniq: () => string;
};

/**
 * Project-wide `test`: import it from here in every spec so page objects are injected as fixtures.
 * Add a fixture for every new page object (the testcase-generator skill does this).
 */
export const test = base.extend<Fixtures>({
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  dashboardPage: async ({ page }, use) => use(new DashboardPage(page)),
  customersPage: async ({ page }, use) => use(new CustomersPage(page)),
  ordersPage: async ({ page }, use) => use(new OrdersPage(page)),
  newOrderPage: async ({ page }, use) => use(new NewOrderPage(page)),
  orderDetailPage: async ({ page }, use) => use(new OrderDetailPage(page)),
  // eslint-disable-next-line no-empty-pattern
  uniq: async ({}, use, testInfo) => {
    let n = 0;
    await use(() => `w${testInfo.workerIndex}${Date.now().toString(36)}${(n++).toString(36)}${Math.random().toString(36).slice(2, 5)}`);
  },
});

export { expect };

/** Use in `test.use(loggedOut)` for tests that must start without a session (login/logout flows). */
export const loggedOut = { storageState: { cookies: [], origins: [] } };
