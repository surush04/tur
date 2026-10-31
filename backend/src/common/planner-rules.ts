import { addMoney, compareMoney, mulMoney } from './money';

export interface PlannerInput {
  startLocation: string;
  region?: string;
  startDate?: string;
  endDate?: string;
  travelers: number;
  budgetTjs: string;
  interests: string[];
  travelStyle?: string;
  transport?: string;
  accommodation?: string;
  accessibility?: string;
}

export interface PlannerPlace {
  id: string;
  name: string;
  region: string;
  category: string;
  summary: string;
  suggestedDays: number;
  budgetMin: string | null;
  activities: string[];
  tourId: string | null;
  tourSlug?: string | null;
  tourTitle: string | null;
  tourPrice: string | null;
}

export interface PlannerActivity {
  title: string;
  placeName: string;
  description: string;
  timeEstimateNote: string;
  transportNote: string;
  estimatedCost: string | null;
  tourId: string | null;
  tourSlug?: string | null;
  sortOrder: number;
}

export interface PlannerDay {
  dayNumber: number;
  title: string;
  notes: string;
  activities: PlannerActivity[];
}

export interface DemoItinerary {
  title: string;
  days: PlannerDay[];
  totalEstimate: string;
  alternatives: string | null;
  budgetShortfall: boolean;
  packing: string[];
  assumptions: string[];
  disclaimer: string;
}

const INTEREST_CATEGORIES: Record<string, string[]> = {
  mountains: ['MOUNTAINS', 'ROAD', 'NATURE'],
  lakes: ['LAKES', 'NATURE'],
  photography: ['LAKES', 'MOUNTAINS', 'NATURE'],
  culture: ['CULTURE', 'CITIES'],
  hiking: ['MOUNTAINS', 'NATURE', 'LAKES'],
  cities: ['CITIES', 'CULTURE'],
  road: ['ROAD', 'NATURE'],
};

export const PLAN_DISCLAIMER =
  'This is a planning estimate built from the Rohi catalog. It is not a live quote, a road report, or a confirmed reservation. Travel times, access, prices, and availability must be verified before you go.';

export function dayCount(input: PlannerInput): number {
  if (input.startDate && input.endDate && input.endDate >= input.startDate) {
    const start = Date.parse(`${input.startDate}T00:00:00Z`);
    const end = Date.parse(`${input.endDate}T00:00:00Z`);
    const days = Math.round((end - start) / 86400000) + 1;
    if (Number.isFinite(days)) return Math.min(10, Math.max(1, days));
  }
  return 2;
}

function score(place: PlannerPlace, input: PlannerInput): number {
  let value = 0;
  const interests = input.interests.map((item) => item.toLowerCase());
  for (const interest of interests) {
    const categories = INTEREST_CATEGORIES[interest] ?? [];
    if (categories.includes(place.category)) value += 3;
    if (place.activities.some((activity) => activity.toLowerCase().includes(interest))) value += 2;
    if (place.summary.toLowerCase().includes(interest)) value += 1;
  }
  if (input.region && place.region === input.region) value += 4;
  if (place.budgetMin && compareMoney(place.budgetMin, input.budgetTjs) <= 0) value += 1;
  return value;
}

function placeCost(place: PlannerPlace, travelers: number): string {
  if (place.tourPrice) return mulMoney(place.tourPrice, travelers);
  if (place.budgetMin) return place.budgetMin;
  return '0.00';
}

function packingFor(interests: string[]): string[] {
  const items = [
    'Passport or identity document',
    'Somoni cash and a charged phone',
    'Layers for changing mountain weather',
    'Reusable water bottle',
  ];
  const text = interests.join(' ').toLowerCase();
  if (text.includes('mountain') || text.includes('hik')) items.push('Sturdy shoes and a light rain layer');
  if (text.includes('photo')) items.push('Spare battery or power bank for a camera');
  if (text.includes('lake')) items.push('Sun protection');
  items.push('Any personal medication in its original packaging');
  return items;
}

function buildFrom(input: PlannerInput, places: PlannerPlace[], days: number): DemoItinerary {
  const ranked = [...places].sort((a, b) => score(b, input) - score(a, input) || a.name.localeCompare(b.name));
  const chosen: PlannerPlace[] = [];
  let estimate = '0.00';
  for (const place of ranked) {
    if (chosen.length >= days) break;
    const cost = placeCost(place, input.travelers);
    const next = addMoney(estimate, cost);
    if (compareMoney(next, input.budgetTjs) > 0 && chosen.length > 0) continue;
    chosen.push(place);
    estimate = next;
  }
  if (chosen.length === 0 && ranked[0]) {
    chosen.push(ranked[0]);
    estimate = placeCost(ranked[0], input.travelers);
  }

  const planDays: PlannerDay[] = chosen.slice(0, days).map((place, index) => {
    const cost = placeCost(place, input.travelers);
    const activities: PlannerActivity[] = [
      {
        title: place.tourTitle ?? `Visit ${place.name}`,
        placeName: place.name,
        description: place.summary,
        timeEstimateNote: 'Not a measured journey time. Confirm the route and the time you need locally.',
        transportNote: input.transport
          ? `Preference noted: ${input.transport}. This is not a reserved transfer.`
          : 'Transport is not reserved. Ask locally which road is open.',
        estimatedCost: cost,
        tourId: place.tourId,
        tourSlug: place.tourSlug ?? null,
        sortOrder: 0,
      },
    ];
    if (place.activities[0]) {
      activities.push({
        title: place.activities[0],
        placeName: place.name,
        description: 'Suggested from the destination activity list. It is not a timed booking.',
        timeEstimateNote: 'Duration is not measured in this catalog.',
        transportNote: 'Stay with your group and do not assume a trail is open.',
        estimatedCost: null,
        tourId: null,
        tourSlug: null,
        sortOrder: 1,
      });
    }
    return {
      dayNumber: index + 1,
      title: `${place.name}`,
      notes: input.accessibility
        ? `Accessibility note from you: ${input.accessibility}. The catalog does not confirm step-free access.`
        : 'Pace the day on site. Mountain roads and paths can take longer than a map suggests.',
      activities,
    };
  });

  const shortfall = compareMoney(estimate, input.budgetTjs) > 0;
  return {
    title: `${input.startLocation} · ${days} day plan`,
    days: planDays,
    totalEstimate: estimate,
    alternatives: shortfall
      ? 'The catalog estimates for the matched places are above this budget. Shorten the trip, choose a city or valley day, or raise the budget and generate the plan again.'
      : null,
    budgetShortfall: shortfall,
    packing: packingFor(input.interests),
    assumptions: [
      'Costs are catalog estimates multiplied for your group, not invoices.',
      'Accommodation is only included when a priced catalog tour says it is included.',
      input.accommodation ? `Accommodation preference noted: ${input.accommodation}.` : 'No accommodation preference was provided.',
      input.travelStyle ? `Travel style noted: ${input.travelStyle}.` : 'No travel style was provided.',
    ],
    disclaimer: PLAN_DISCLAIMER,
  };
}

export function buildDemoItinerary(input: PlannerInput, places: PlannerPlace[]): DemoItinerary {
  const days = dayCount(input);
  const affordable = places.filter((place) => !place.budgetMin || compareMoney(place.budgetMin, input.budgetTjs) <= 0);
  const pool = affordable.length > 0 ? affordable : places;
  const plan = buildFrom(input, pool, days);
  if (!plan.budgetShortfall) return plan;
  const cheaper = [...places].sort((a, b) => {
    const left = a.budgetMin ?? a.tourPrice ?? '999999.00';
    const right = b.budgetMin ?? b.tourPrice ?? '999999.00';
    return compareMoney(left, right);
  });
  const alternative = buildFrom(input, cheaper, 1);
  return {
    ...alternative,
    title: `${input.startLocation} · lower-cost alternative`,
    alternatives:
      'The original request does not fit the catalog estimates. This one-day alternative uses the lower catalog figures. It is still an estimate and still needs local confirmation.',
    budgetShortfall: compareMoney(alternative.totalEstimate, input.budgetTjs) > 0,
  };
}
