import { PrismaService } from '../prisma/prisma.service';

export interface RatingSummary {
  rating: number | null;
  ratingCount: number;
}

export async function tourRatings(prisma: PrismaService, tourIds: string[]) {
  const map = new Map<string, RatingSummary>();
  if (!tourIds.length) return map;
  const rows = await prisma.review.groupBy({
    by: ['tourId'],
    where: { status: 'PUBLISHED', tourId: { in: tourIds } },
    _avg: { rating: true },
    _count: { rating: true },
  });
  for (const row of rows) {
    if (!row.tourId) continue;
    const count = row._count.rating;
    const avg = row._avg.rating;
    map.set(row.tourId, {
      rating: count && avg != null ? Math.round(avg * 10) / 10 : null,
      ratingCount: count,
    });
  }
  return map;
}

export function combineRatings(parts: RatingSummary[]): RatingSummary {
  const count = parts.reduce((sum, part) => sum + part.ratingCount, 0);
  if (!count) return { rating: null, ratingCount: 0 };
  const weighted = parts.reduce((sum, part) => sum + (part.rating ?? 0) * part.ratingCount, 0);
  return { rating: Math.round((weighted / count) * 10) / 10, ratingCount: count };
}
