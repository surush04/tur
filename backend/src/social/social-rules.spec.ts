import {
  canReadGroupChat,
  contactRateLimited,
  initialVideoStatus,
  inquiryReservesSeats,
  isOperatorRole,
  visibleToOperators,
} from './social-rules';

describe('social rules', () => {
  it('hides private groups from operators and keeps chat to members', () => {
    expect(visibleToOperators('PRIVATE')).toBe(false);
    expect(visibleToOperators('PUBLIC')).toBe(true);
    expect(canReadGroupChat(false)).toBe(false);
    expect(canReadGroupChat(true)).toBe(true);
  });

  it('does not let a traveler publish a video or grant themselves an operator role', () => {
    expect(initialVideoStatus('USER')).toBe('PENDING');
    expect(initialVideoStatus('PROVIDER')).toBe('PUBLISHED');
    expect(isOperatorRole('USER')).toBe(false);
    expect(isOperatorRole('PROVIDER')).toBe(true);
  });

  it('limits contact requests and never treats an inquiry as a seat hold', () => {
    expect(contactRateLimited(4)).toBe(false);
    expect(contactRateLimited(5)).toBe(true);
    expect(inquiryReservesSeats()).toBe(false);
  });
});
