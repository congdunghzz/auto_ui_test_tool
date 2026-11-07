import type { CustomerInput } from '../pages/CustomerFormDialog';

/** A valid customer whose name/email are unique for this test (safe for parallel runs). */
export function newCustomer(id: string, overrides: CustomerInput = {}): Required<Pick<CustomerInput, 'name' | 'email'>> & CustomerInput {
  return {
    name: `QA Khách ${id}`,
    email: `qa.${id}@example.com`,
    phone: '0911222333',
    ...overrides,
  } as Required<Pick<CustomerInput, 'name' | 'email'>> & CustomerInput;
}

/** A string of exactly `length` characters that starts with a unique prefix. */
export function textOfLength(prefix: string, length: number): string {
  return (prefix + 'x'.repeat(length)).slice(0, length);
}
