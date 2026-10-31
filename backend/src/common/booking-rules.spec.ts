import { assertBookable, canTransition, quoteTotal, releasesSeats } from './booking-rules';

const base = {
  published: true,
  status: 'OPEN',
  capacity: 8,
  bookedSeats: 6,
  travelers: 2,
  startDate: '2026-11-10',
  today: '2026-10-29',
};

describe('booking rules', () => {
  it('quotes only the stored unit price and traveler count', () => {
    expect(quoteTotal('180.00', 4)).toBe('720.00');
  });

  it('blocks overbooking, closed dates, past dates, and unpublished tours', () => {
    expect(assertBookable(base)).toBeNull();
    expect(assertBookable({ ...base, travelers: 3 })).toBe('CAPACITY');
    expect(assertBookable({ ...base, status: 'CLOSED' })).toBe('CLOSED');
    expect(assertBookable({ ...base, startDate: '2026-10-01' })).toBe('DATE');
    expect(assertBookable({ ...base, published: false })).toBe('UNPUBLISHED');
    expect(assertBookable({ ...base, travelers: 0 })).toBe('TRAVELERS');
  });

  it('limits status changes and seat release', () => {
    expect(canTransition('PENDING', 'CONFIRMED', 'ADMIN')).toBe(true);
    expect(canTransition('PENDING', 'CONFIRMED', 'USER')).toBe(false);
    expect(canTransition('CONFIRMED', 'CANCELLED', 'USER')).toBe(true);
    expect(canTransition('COMPLETED', 'CANCELLED', 'ADMIN')).toBe(false);
    expect(releasesSeats('PENDING', 'CANCELLED')).toBe(true);
    expect(releasesSeats('PENDING', 'CONFIRMED')).toBe(false);
  });
});
