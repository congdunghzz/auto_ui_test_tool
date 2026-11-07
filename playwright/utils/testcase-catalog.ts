import fs from 'node:fs';
import path from 'node:path';

export type CatalogEntry = {
  id: string;
  title: string;
  feature: string;
  file: string;
  type?: string;
  priority?: string;
  tags: string[];
};

const TC_HEADING = /^##\s+(TC-[A-Za-z0-9_.-]+)\s*[:\-–—]\s*(.+?)\s*$/;
const META = /^\s*[-*]\s+\*\*(Type|Priority|Tags)[^*]*\*\*\s*:?\s*(.*)$/i;

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

/** Parse every QA test case (## TC-XXX: title) under testcases/ (folders/files starting with _ are ignored). */
export function loadCatalog(root: string): CatalogEntry[] {
  const dir = path.join(root, 'testcases');
  const entries: CatalogEntry[] = [];
  for (const file of walk(dir)) {
    const feature = path.relative(dir, file).split(path.sep)[0].replace(/\.md$/, '');
    let current: CatalogEntry | null = null;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const h = line.match(TC_HEADING);
      if (h) {
        current = { id: h[1], title: h[2], feature, file: path.relative(root, file).split(path.sep).join('/'), tags: [] };
        entries.push(current);
        continue;
      }
      if (/^#{1,2}\s/.test(line)) current = null;
      const m = current && line.match(META);
      if (current && m) {
        const key = m[1].toLowerCase();
        if (key === 'tags') current.tags = m[2].split(/[,;]/).map((t) => t.trim()).filter(Boolean);
        else if (key === 'type') current.type = m[2].trim();
        else current.priority = m[2].trim();
      }
    }
  }
  return entries;
}

export type AutomatedInfo = {
  files: string[];
  /** 'test' = runnable test; 'fixme' / 'skip' = placeholder (BLOCKED / SKIPPED), not real automation. */
  kinds: Set<'test' | 'fixme' | 'skip'>;
};

/**
 * Find quoted '@TC-...' tags in spec files (static scan, no Playwright needed) and whether each
 * belongs to a runnable test or to a test.fixme / test.skip placeholder.
 */
export function scanAutomatedIds(root: string): Map<string, AutomatedInfo> {
  const dir = path.join(root, 'playwright', 'tests');
  const found = new Map<string, AutomatedInfo>();
  const visit = (d: string) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) visit(full);
      else if (/\.(spec|test|setup)\.ts$/.test(e.name)) {
        const text = fs.readFileSync(full, 'utf8');
        const relFile = path.relative(root, full).split(path.sep).join('/');
        const calls = [...text.matchAll(/\btest(\.fixme|\.skip|\.only)?\s*\(/g)].map((m) => ({
          index: m.index ?? 0,
          kind: (m[1] === '.fixme' ? 'fixme' : m[1] === '.skip' ? 'skip' : 'test') as 'test' | 'fixme' | 'skip',
        }));
        for (const m of text.matchAll(/['"`]@(TC-[A-Za-z0-9][A-Za-z0-9_.-]*)['"`]/g)) {
          const call = calls.filter((c) => c.index < (m.index ?? 0)).pop();
          const info = found.get(m[1]) ?? { files: [], kinds: new Set() };
          if (!info.files.includes(relFile)) info.files.push(relFile);
          info.kinds.add(call?.kind ?? 'test');
          found.set(m[1], info);
        }
      }
    }
  };
  visit(dir);
  return found;
}
