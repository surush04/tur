import { buildDemoItinerary, dayCount, type PlannerPlace } from './planner-rules';

const places: PlannerPlace[] = [
  {
    id: 'lake',
    name: 'Iskanderkul Lake',
    region: 'SUGHD',
    category: 'LAKES',
    summary: 'A mountain lake for photography.',
    suggestedDays: 2,
    budgetMin: '400.00',
    activities: ['photography', 'picnic'],
    tourId: 'tour-lake',
    tourTitle: 'Lake day',
    tourPrice: '350.00',
  },
  {
    id: 'city',
    name: 'Dushanbe',
    region: 'DUSHANBE',
    category: 'CITIES',
    summary: 'Capital walks and museums.',
    suggestedDays: 1,
    budgetMin: '150.00',
    activities: ['museums'],
    tourId: null,
    tourTitle: null,
    tourPrice: null,
  },
  {
    id: 'pamir',
    name: 'Pamir Highway',
    region: 'GBAO',
    category: 'ROAD',
    summary: 'A long high-mountain road.',
    suggestedDays: 8,
    budgetMin: '4000.00',
    activities: ['road'],
    tourId: 'tour-pamir',
    tourTitle: 'Pamir overview',
    tourPrice: '6500.00',
  },
];

describe('demo itinerary', () => {
  it('counts inclusive travel dates and caps the length', () => {
    expect(dayCount({ startLocation: 'Dushanbe', travelers: 2, budgetTjs: '100.00', interests: [], startDate: '2026-11-01', endDate: '2026-11-02' })).toBe(2);
  });

  it('prefers lakes when the traveler asks for lakes and stays inside the budget', () => {
    const plan = buildDemoItinerary(
      {
        startLocation: 'Dushanbe',
        travelers: 2,
        budgetTjs: '1500.00',
        interests: ['lakes', 'photography'],
        startDate: '2026-11-01',
        endDate: '2026-11-01',
      },
      places,
    );
    expect(plan.days[0]?.title).toBe('Iskanderkul Lake');
    expect(plan.totalEstimate).toBe('700.00');
    expect(plan.budgetShortfall).toBe(false);
    expect(plan.disclaimer).toContain('not a live quote');
  });

  it('returns a labeled alternative when the budget cannot cover the catalog', () => {
    const plan = buildDemoItinerary(
      {
        startLocation: 'Dushanbe',
        travelers: 2,
        budgetTjs: '50.00',
        interests: ['mountains'],
      },
      places,
    );
    expect(plan.budgetShortfall).toBe(true);
    expect(plan.alternatives).toBeTruthy();
    expect(plan.days).toHaveLength(1);
  });
});
