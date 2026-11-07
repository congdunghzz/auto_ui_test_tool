/**
 * Convert QA test cases from Excel (.xlsx) or CSV into the canonical Markdown format
 * used by the testcase-generator skill.
 *
 *   npm run testcases:import -- path/to/cases.xlsx [--feature order] [--sheet "Sheet1"] [--force]
 *   npm run testcases:template        # writes testcases/_template/testcases-template.{xlsx,csv}
 *
 * Column headers are matched case-insensitively, English or Vietnamese (see COLUMNS).
 * A row without an ID continues the previous test case (one-step-per-row layouts).
 */
import ExcelJS from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, rel, writeFile } from './lib/env';

type Field = 'id' | 'feature' | 'title' | 'type' | 'priority' | 'tags' | 'preconditions' | 'data' | 'steps' | 'expected';
const COLUMNS: Record<Field, string[]> = {
  id: ['id', 'tc id', 'tc', 'test case id', 'testcase id', 'mã tc', 'mã testcase', 'mã test case', 'ma tc'],
  feature: ['feature', 'tính năng', 'chức năng', 'module', 'màn hình'],
  title: ['title', 'scenario', 'test case', 'testcase', 'tên testcase', 'tên test case', 'kịch bản', 'mô tả', 'summary'],
  type: ['type', 'loại', 'loại test'],
  priority: ['priority', 'độ ưu tiên', 'ưu tiên'],
  tags: ['tags', 'tag', 'nhãn'],
  preconditions: ['preconditions', 'precondition', 'pre-condition', 'điều kiện', 'tiền điều kiện', 'điều kiện tiên quyết'],
  data: ['test data', 'data', 'dữ liệu', 'dữ liệu test', 'dữ liệu kiểm thử'],
  steps: ['steps', 'step', 'test steps', 'các bước', 'bước thực hiện', 'các bước thực hiện'],
  expected: ['expected', 'expected result', 'expected results', 'kết quả mong đợi', 'kết quả mong muốn', 'kết quả'],
};
const HEADERS: Record<Field, string> = {
  id: 'ID', feature: 'Feature', title: 'Title', type: 'Type', priority: 'Priority', tags: 'Tags',
  preconditions: 'Preconditions', data: 'Test data', steps: 'Steps', expected: 'Expected',
};

type Case = Record<Field, string>;
const argv = process.argv.slice(2);
const opt = (n: string) => (argv.indexOf(`--${n}`) >= 0 ? argv[argv.indexOf(`--${n}`) + 1] : undefined);
const slug = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if ('richText' in v) return v.richText.map((r) => r.text).join('');
    if ('text' in v) return String(v.text);
    if ('result' in v) return String(v.result ?? '');
    if (v instanceof Date) return v.toISOString().slice(0, 10);
  }
  return String(v);
}

async function readRows(file: string): Promise<string[][]> {
  const wb = new ExcelJS.Workbook();
  let ws: ExcelJS.Worksheet | undefined;
  if (/\.csv$/i.test(file)) ws = await wb.csv.readFile(file);
  else {
    await wb.xlsx.readFile(file);
    ws = opt('sheet') ? wb.getWorksheet(opt('sheet')!) : wb.worksheets[0];
  }
  if (!ws) throw new Error('Worksheet not found');
  const rows: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const values = (row.values as ExcelJS.CellValue[]).slice(1).map(cellText);
    rows.push(values.map((v) => v.replace(/^﻿/, '').trim()));
  });
  return rows;
}

function mapHeader(header: string[]): Partial<Record<Field, number>> {
  const map: Partial<Record<Field, number>> = {};
  header.forEach((h, i) => {
    const key = h.toLowerCase().replace(/\s+/g, ' ').trim();
    for (const [field, aliases] of Object.entries(COLUMNS) as [Field, string[]][]) {
      if (map[field] === undefined && aliases.includes(key)) map[field] = i;
    }
  });
  return map;
}

const lines = (s: string) =>
  s.split(/\r?\n/).map((l) => l.replace(/^\s*(\d+[.)]|[-*•])\s*/, '').trim()).filter(Boolean);

function toMarkdown(feature: string, source: string, cases: Case[]): string {
  let out = `# Feature: ${feature}\n\n- **Source:** ${source} (imported ${new Date().toISOString().slice(0, 10)})\n- **Screens:** UNKNOWN — the generator maps steps to knowledge/screens/\n\n`;
  for (const c of cases) {
    out += `## ${c.id}: ${c.title || '(no title)'}\n\n`;
    if (c.type) out += `- **Type:** ${c.type}\n`;
    if (c.priority) out += `- **Priority:** ${c.priority}\n`;
    if (c.tags) out += `- **Tags:** ${c.tags}\n`;
    out += `- **Preconditions:** ${lines(c.preconditions).join('; ') || '—'}\n`;
    out += `- **Test data:** ${lines(c.data).join('; ') || '—'}\n\n`;
    out += `**Steps**\n\n${lines(c.steps).map((s, i) => `${i + 1}. ${s}`).join('\n') || '1. ⚠ MISSING STEPS'}\n\n`;
    out += `**Expected**\n\n${lines(c.expected).map((e) => `- ${e}`).join('\n') || '- ⚠ MISSING EXPECTED RESULT'}\n\n`;
  }
  return out;
}

async function writeTemplate() {
  const dir = path.join(ROOT, 'testcases', '_template');
  const header = (Object.keys(HEADERS) as Field[]).map((f) => HEADERS[f]);
  const sample = [
    ['TC-ORD-101', 'order', 'Tạo đơn hàng hợp lệ', 'positive', 'high', 'smoke',
      'Đã đăng nhập', 'Khách hàng: Nguyễn Văn An\nSố lượng: 2',
      '1. Mở màn hình Tạo đơn hàng\n2. Chọn khách hàng\n3. Nhập số lượng\n4. Nhấn "Tạo đơn"',
      'Chuyển sang trang chi tiết đơn hàng\nHiển thị thông báo "Đã tạo đơn hàng ..."'],
  ];
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Testcases');
  ws.addRow(header).font = { bold: true };
  sample.forEach((r) => ws.addRow(r));
  ws.columns.forEach((c) => (c.width = 28));
  ws.eachRow((r) => r.eachCell((cell) => (cell.alignment = { wrapText: true, vertical: 'top' })));
  fs.mkdirSync(dir, { recursive: true });
  await wb.xlsx.writeFile(path.join(dir, 'testcases-template.xlsx'));
  const csvCell = (v: string) => `"${v.replace(/"/g, '""')}"`;
  writeFile(path.join(dir, 'testcases-template.csv'), '﻿' + [header, ...sample].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n');
  console.log(`✔ Templates written to ${rel(dir)}/`);
}

async function main() {
  if (argv.includes('--template')) return writeTemplate();
  const input = argv.find((a) => !a.startsWith('--') && a !== opt('feature') && a !== opt('sheet') && a !== opt('out'));
  if (!input) throw new Error('Usage: npm run testcases:import -- <file.xlsx|file.csv> [--feature name] [--sheet name] [--force]');
  const file = path.resolve(input);
  const rows = await readRows(file);
  const headerIdx = rows.findIndex((r) => mapHeader(r).id !== undefined);
  if (headerIdx < 0) throw new Error(`No header row with an ID column found. Expected one of: ${COLUMNS.id.join(', ')}`);
  const map = mapHeader(rows[headerIdx]);
  const missing = (['id', 'steps', 'expected'] as Field[]).filter((f) => map[f] === undefined);
  if (missing.length) throw new Error(`Missing required column(s): ${missing.join(', ')}`);

  const cases: Case[] = [];
  for (const row of rows.slice(headerIdx + 1)) {
    const get = (f: Field) => (map[f] !== undefined ? row[map[f]!] ?? '' : '');
    if (get('id')) {
      cases.push(Object.fromEntries((Object.keys(COLUMNS) as Field[]).map((f) => [f, get(f)])) as Case);
    } else if (cases.length && (get('steps') || get('expected'))) {
      const prev = cases[cases.length - 1]; // one-step-per-row layout
      if (get('steps')) prev.steps += '\n' + get('steps');
      if (get('expected')) prev.expected += '\n' + get('expected');
      if (get('data')) prev.data += '\n' + get('data');
    }
  }
  if (!cases.length) throw new Error('No test cases found');
  const dupes = cases.map((c) => c.id).filter((id, i, a) => a.indexOf(id) !== i);
  if (dupes.length) throw new Error(`Duplicate test case IDs: ${[...new Set(dupes)].join(', ')}`);

  const feature = slug(opt('feature') ?? cases[0].feature ?? '') || slug(path.basename(file, path.extname(file)));
  const out = path.resolve(opt('out') ?? path.join(ROOT, 'testcases', feature, `${slug(path.basename(file, path.extname(file)))}.md`));
  if (fs.existsSync(out) && !argv.includes('--force')) throw new Error(`${rel(out)} already exists (use --force to overwrite)`);
  writeFile(out, toMarkdown(feature, path.basename(file), cases));

  const warnings = cases.flatMap((c) => [
    !c.title && `${c.id}: missing title`,
    !c.steps && `${c.id}: missing steps`,
    !c.expected && `${c.id}: missing expected result`,
  ]).filter(Boolean);
  console.log(`✔ Imported ${cases.length} test case(s) → ${rel(out)}`);
  if (warnings.length) console.log(`⚠ ${warnings.join('\n⚠ ')}`);
}

main().catch((e) => {
  console.error('✖', e.message);
  process.exit(1);
});
