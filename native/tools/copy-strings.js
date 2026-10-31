const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../../mobile/src/app/core/i18n.ts'), 'utf8');
const start = src.indexOf('export type Lang');
const end = src.indexOf('@Injectable');
let body = src.slice(start, end);
body = body.replace('const en:', 'export const en:').replace('const dictionaries', 'export const dictionaries');
const extra = `
export function formatTjs(value: string | number | null | undefined): string {
  if (value == null || value === '') return '';
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount)) return String(value) + ' TJS';
  return new Intl.NumberFormat('en-US').format(Math.round(amount)) + ' TJS';
}
`;
fs.mkdirSync(path.join(__dirname, '../src'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '../src/strings.ts'), body.trim() + '\n' + extra);
