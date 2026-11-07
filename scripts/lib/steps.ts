import type { Locator, Page } from '@playwright/test';

/**
 * A tiny, declarative way to describe UI actions in JSON config
 * (explorer login steps and "states" to reveal modals / validation messages).
 */
export type Target = {
  testId?: string;
  role?: Parameters<Page['getByRole']>[0];
  name?: string;
  exact?: boolean;
  label?: string;
  placeholder?: string;
  text?: string;
  css?: string;
  nth?: number;
  within?: Target;
};

export type Step =
  | { action: 'goto'; value: string }
  | { action: 'click'; target: Target }
  | { action: 'fill'; target: Target; value: string }
  | { action: 'select'; target: Target; value: string }
  | { action: 'check' | 'uncheck'; target: Target }
  | { action: 'press'; target?: Target; value: string }
  | { action: 'waitForURL'; value: string }
  | { action: 'waitFor'; target: Target }
  | { action: 'wait'; value: number };

export function resolveTarget(page: Page, t: Target): Locator {
  const root: Page | Locator = t.within ? resolveTarget(page, t.within) : page;
  let loc: Locator;
  if (t.testId) loc = root.getByTestId(t.testId);
  else if (t.role) loc = root.getByRole(t.role, t.name ? { name: t.name, exact: t.exact } : {});
  else if (t.label) loc = root.getByLabel(t.label, { exact: t.exact });
  else if (t.placeholder) loc = root.getByPlaceholder(t.placeholder, { exact: t.exact });
  else if (t.text) loc = root.getByText(t.text, { exact: t.exact });
  else if (t.css) loc = root.locator(t.css);
  else throw new Error(`Invalid target: ${JSON.stringify(t)}`);
  return t.nth !== undefined ? loc.nth(t.nth) : loc;
}

export function describeTarget(t: Target): string {
  const self = t.testId
    ? `testId=${t.testId}`
    : t.role
      ? `role=${t.role}${t.name ? `[name="${t.name}"]` : ''}`
      : t.label
        ? `label="${t.label}"`
        : t.placeholder
          ? `placeholder="${t.placeholder}"`
          : t.text
            ? `text="${t.text}"`
            : `css=${t.css}`;
  const nth = t.nth !== undefined ? ` (nth=${t.nth})` : '';
  return (t.within ? `${describeTarget(t.within)} >> ` : '') + self + nth;
}

export function describeStep(s: Step): string {
  switch (s.action) {
    case 'goto':
    case 'waitForURL':
      return `${s.action} ${s.value}`;
    case 'wait':
      return `wait ${s.value}ms`;
    case 'fill':
    case 'select':
      return `${s.action} ${describeTarget(s.target)} = "${/pass/i.test(describeTarget(s.target)) ? '***' : s.value}"`;
    case 'press':
      return `press ${s.value}${s.target ? ' on ' + describeTarget(s.target) : ''}`;
    default:
      return `${s.action} ${describeTarget(s.target)}`;
  }
}

export async function runSteps(page: Page, steps: Step[], baseURL: string): Promise<void> {
  for (const s of steps) {
    switch (s.action) {
      case 'goto':
        await page.goto(new URL(s.value, baseURL).toString());
        break;
      case 'click':
        await resolveTarget(page, s.target).click();
        break;
      case 'fill':
        await resolveTarget(page, s.target).fill(s.value);
        break;
      case 'select':
        await resolveTarget(page, s.target).selectOption({ label: s.value }).catch(() =>
          resolveTarget(page, s.target).selectOption(s.value),
        );
        break;
      case 'check':
        await resolveTarget(page, s.target).check();
        break;
      case 'uncheck':
        await resolveTarget(page, s.target).uncheck();
        break;
      case 'press':
        if (s.target) await resolveTarget(page, s.target).press(s.value);
        else await page.keyboard.press(s.value);
        break;
      case 'waitForURL':
        await page.waitForURL(s.value);
        break;
      case 'waitFor':
        await resolveTarget(page, s.target).waitFor();
        break;
      case 'wait':
        await page.waitForTimeout(s.value);
        break;
    }
  }
}
