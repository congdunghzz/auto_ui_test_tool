/** Test account from .env (loaded by playwright.config.ts). Never hard-code credentials in tests. */
export function credentials(): { username: string; password: string } {
  const username = process.env.QA_USERNAME;
  const password = process.env.QA_PASSWORD;
  if (!username || !password) throw new Error('QA_USERNAME / QA_PASSWORD are not set (copy .env.example to .env)');
  return { username, password };
}
