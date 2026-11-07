import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(__dirname, '..', '..');

/** Load .env (if present) into process.env without overriding existing variables. */
export function loadEnv(file = path.join(ROOT, '.env')): void {
  if (!fs.existsSync(file)) return;
  try {
    process.loadEnvFile(file);
  } catch {
    // ignore malformed .env; scripts will report missing variables explicitly
  }
}

/** Replace ${VAR} placeholders with environment values. Throws if a variable is missing. */
export function interpolate<T>(value: T): T {
  if (typeof value === 'string') {
    return value.replace(/\$\{(\w+)\}/g, (_, name: string) => {
      const v = process.env[name];
      if (v === undefined) throw new Error(`Missing environment variable ${name} (set it in .env)`);
      return v;
    }) as T;
  }
  if (Array.isArray(value)) return value.map((v) => interpolate(v)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, interpolate(v)])) as T;
  }
  return value;
}

export function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

export function writeFile(file: string, content: string | Buffer): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

export function rel(file: string): string {
  return path.relative(ROOT, file).split(path.sep).join('/');
}
