export type AppLang = 'en' | 'ru' | 'tg';

export interface LocalizedCopy {
  title?: string;
  summary?: string;
  description?: string;
  tips?: string;
}

export function requestLang(header: string | undefined): AppLang {
  const value = (header ?? 'en').toLowerCase();
  if (value.startsWith('ru')) return 'ru';
  if (value.startsWith('tg') || value.startsWith('tj')) return 'tg';
  return 'en';
}

export function localize(copy: unknown, lang: AppLang): Required<Pick<LocalizedCopy, 'summary' | 'description'>> & LocalizedCopy {
  const bag = (copy ?? {}) as Record<string, LocalizedCopy>;
  const chosen = bag[lang] ?? {};
  const english = bag['en'] ?? {};
  return {
    title: chosen.title ?? english.title,
    summary: chosen.summary ?? english.summary ?? '',
    description: chosen.description ?? english.description ?? '',
    tips: chosen.tips ?? english.tips,
  };
}

export function pageArgs(pageRaw?: number, sizeRaw?: number) {
  const page = Number.isFinite(pageRaw) && pageRaw && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const pageSize = Number.isFinite(sizeRaw) && sizeRaw && sizeRaw > 0 ? Math.min(50, Math.floor(sizeRaw)) : 20;
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function todayUtc(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function slugify(value: string): string {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return slug || 'place';
}
